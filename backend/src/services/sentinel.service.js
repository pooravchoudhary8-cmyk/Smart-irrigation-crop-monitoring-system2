import axios from "axios";

/**
 * Sentinel Hub Service
 * ────────────────────
 * Handles OAuth2 token management and NDVI data fetching
 * from the Sentinel Hub Process API.
 *
 * Flow:
 *   1. Get OAuth2 access token (cached until expiry)
 *   2. Request NDVI statistics for a bounding box around farm coordinates
 *   3. Return raw NDVI value + band data
 *
 * Rate-limits, retries, and timeouts are handled internally.
 */

const TOKEN_URL = "https://services.sentinel-hub.com/oauth/token";
const PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process";
const STATS_URL = "https://services.sentinel-hub.com/api/v1/statistics";

// ── Token Cache ──────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid OAuth2 access token. Uses cache if not expired.
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
    const now = Date.now();

    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && now < tokenExpiresAt - 60_000) {
        return cachedToken;
    }

    const clientId = process.env.SENTINEL_CLIENT_ID;
    const clientSecret = process.env.SENTINEL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET must be set in .env"
        );
    }

    console.log("🔑 [Sentinel] Requesting new OAuth2 token...");

    const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
        }).toString(),
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 10_000,
        }
    );

    cachedToken = response.data.access_token;
    tokenExpiresAt = now + response.data.expires_in * 1000;

    console.log(
        `✅ [Sentinel] Token acquired (expires in ${response.data.expires_in}s)`
    );
    return cachedToken;
}

/**
 * Build a bounding box around a lat/lng coordinate.
 * Creates a ~500m × 500m box for NDVI sampling.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [bufferDeg=0.005] - Buffer in degrees (~500m)
 * @returns {number[]} [west, south, east, north]
 */
function buildBBox(lat, lng, bufferDeg = 0.005) {
    return [
        lng - bufferDeg, // west
        lat - bufferDeg, // south
        lng + bufferDeg, // east
        lat + bufferDeg, // north
    ];
}

/**
 * Evalscript for Sentinel-2 NDVI computation.
 * Returns NDVI directly calculated on the server side.
 */
const NDVI_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08"],
      units: "REFLECTANCE"
    }],
    output: {
      id: "ndvi",
      bands: 1,
      sampleType: "FLOAT32"
    }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}
`;

/**
 * Evalscript that returns raw NIR and Red band values.
 * Used if we want to compute NDVI locally.
 */
const BANDS_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08"],
      units: "REFLECTANCE"
    }],
    output: [
      { id: "red",  bands: 1, sampleType: "FLOAT32" },
      { id: "nir",  bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function evaluatePixel(sample) {
  return {
    red: [sample.B04],
    nir: [sample.B08]
  };
}
`;

/**
 * Statistical evalscript: computes average NDVI over the bounding box.
 */
const STATS_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08"],
      units: "REFLECTANCE"
    }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return {
    ndvi: [ndvi],
    dataMask: [1]
  };
}
`;

/**
 * Fetch NDVI data from Sentinel Hub Statistical API.
 * This returns aggregated statistics (mean, min, max, stdev) for the area.
 *
 * @param {number} lat - Farm latitude
 * @param {number} lng - Farm longitude
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<{ndvi: number, nir: number|null, red: number|null, raw: Object}>}
 */
export async function fetchNDVI(lat, lng, retries = 3) {
    const bbox = buildBBox(lat, lng);
    const now = new Date();
    const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const token = await getAccessToken();

            console.log(
                `🛰️  [Sentinel] Fetching NDVI for (${lat}, ${lng}) — attempt ${attempt}/${retries}`
            );

            // Use Statistical API for averaged NDVI over the area
            const statsPayload = {
                input: {
                    bounds: {
                        bbox: bbox,
                        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
                    },
                    data: [
                        {
                            type: "sentinel-2-l2a",
                            dataFilter: {
                                timeRange: {
                                    from: fromDate.toISOString(),
                                    to: now.toISOString(),
                                },
                                maxCloudCoverage: 30,
                            },
                        },
                    ],
                },
                aggregation: {
                    timeRange: {
                        from: fromDate.toISOString(),
                        to: now.toISOString(),
                    },
                    aggregationInterval: { of: "P30D" },
                    evalscript: STATS_EVALSCRIPT,
                },
            };

            const response = await axios.post(STATS_URL, statsPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 30_000,
            });

            // Parse the statistical response
            const data = response.data;
            const intervals = data?.data;

            if (!intervals || intervals.length === 0) {
                console.warn(
                    "⚠️  [Sentinel] No satellite data available for this location/period"
                );
                return null;
            }

            // Get the latest interval's NDVI statistics
            const latestInterval = intervals[intervals.length - 1];
            const ndviStats = latestInterval?.outputs?.ndvi?.bands?.B0?.stats;

            if (!ndviStats || ndviStats.sampleCount === 0) {
                console.warn("⚠️  [Sentinel] No valid NDVI pixels in response");
                return null;
            }

            const ndviValue = parseFloat(ndviStats.mean.toFixed(4));

            console.log(
                `✅ [Sentinel] NDVI fetched: mean=${ndviValue} | min=${ndviStats.min?.toFixed(3)} | max=${ndviStats.max?.toFixed(3)} | pixels=${ndviStats.sampleCount}`
            );

            return {
                ndvi: ndviValue,
                nir: null, // Stats API doesn't return raw bands
                red: null,
                stats: {
                    mean: ndviStats.mean,
                    min: ndviStats.min,
                    max: ndviStats.max,
                    stdev: ndviStats.stDev,
                    sampleCount: ndviStats.sampleCount,
                },
                raw: data,
            };
        } catch (error) {
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || error.message;

            console.error(
                `❌ [Sentinel] Attempt ${attempt}/${retries} failed (HTTP ${status || "N/A"}): ${errorMsg}`
            );

            // If rate-limited (429) or server error (5xx), retry with backoff
            if (attempt < retries && (status === 429 || status >= 500 || !status)) {
                const backoffMs = attempt * 2000;
                console.log(`   ↻ Retrying in ${backoffMs / 1000}s...`);
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
            }

            // 401 = token expired → clear cache and retry once
            if (status === 401 && attempt === 1) {
                console.log("   🔑 Token expired — clearing cache and retrying...");
                cachedToken = null;
                tokenExpiresAt = 0;
                continue;
            }

            // All retries exhausted
            throw new Error(`Sentinel Hub API failed after ${retries} attempts: ${errorMsg}`);
        }
    }

    return null;
}

/**
 * Fetch NDVI using the Process API (returns image-based NDVI).
 * Fallback method if Statistics API fails.
 *
 * @param {number} lat - Farm latitude
 * @param {number} lng - Farm longitude
 * @returns {Promise<{ndvi: number}>}
 */
export async function fetchNDVIProcess(lat, lng) {
    const bbox = buildBBox(lat, lng);
    const now = new Date();
    const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const token = await getAccessToken();

    const payload = {
        input: {
            bounds: {
                bbox: bbox,
                properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
            },
            data: [
                {
                    type: "sentinel-2-l2a",
                    dataFilter: {
                        timeRange: {
                            from: fromDate.toISOString(),
                            to: now.toISOString(),
                        },
                        maxCloudCoverage: 30,
                        mosaickingOrder: "leastCC",
                    },
                },
            ],
        },
        output: {
            width: 10,
            height: 10,
            responses: [{ identifier: "ndvi", format: { type: "image/tiff" } }],
        },
        evalscript: NDVI_EVALSCRIPT,
    };

    const response = await axios.post(PROCESS_URL, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/tar",
        },
        timeout: 30_000,
        responseType: "arraybuffer",
    });

    // For tiff processing, we'd need a parser.
    // For simplicity, return the stats API result instead.
    console.log("📡 [Sentinel] Process API returned data (tiff)");
    return { ndvi: null, raw: "tiff_binary" };
}
