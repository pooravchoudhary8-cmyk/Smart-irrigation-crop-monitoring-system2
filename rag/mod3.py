"""
mod3.py — Kissan Expert Bot (RAG-enhanced with ChromaDB)
=========================================================
Uses ChromaDB vector store to retrieve relevant agricultural context,
then sends it along with the user query to Google Gemini for a
grounded, accurate response.
"""
import os
import warnings
import logging
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# ── Suppress noisy library logs ───────────────────────────────────────────────
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
logging.getLogger("langchain").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent  # rag directory
PERSIST_DIRECTORY = str(BASE_DIR / "chroma_db")

# ── Embeddings (same model used when building the DB) ─────────────────────────
# Set the new HuggingFace endpoint to avoid deprecated API error
os.environ["HF_INFERENCE_ENDPOINT"] = "https://router.huggingface.co"

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# ── Load persisted ChromaDB vector store ──────────────────────────────────────
try:
    vectorstore = Chroma(
        persist_directory=PERSIST_DIRECTORY,
        embedding_function=embeddings,
        collection_name="my_collection",
    )
    
    # ── MMR retriever for diverse, relevant context ───────────────────────────────
    mmr_retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 4},
    )
except Exception as e:
    print(f"Warning: Could not load ChromaDB: {e}")
    vectorstore = None
    mmr_retriever = None


class KisanExpertBot:

    def __init__(self):
        token = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

        if not token:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY missing in .env")

        genai.configure(api_key=token)
        self.model = genai.GenerativeModel('gemini-pro')

        self.system_prompt = """
        You are Kissan — an Indian agriculture expert AI assistant.

        Help farmers with:
        - crop diseases
        - fertilizers
        - irrigation
        - soil health
        - pest control
        - organic farming
        - govt schemes
        - market advice

        Speak in simple English.
        Give practical step-by-step advice.

        Rules:
        - Always answer the farmer's question using your own knowledge.
        - Use the reference context below only as extra reference if relevant.
        - Never say "the information is not in the provided text" or similar.
        - Keep your answer practical and actionable.
        """

    def _retrieve_context(self, query: str) -> str:
        """Retrieve relevant documents from ChromaDB and join them."""
        if not mmr_retriever:
            return ""
        try:
            docs = mmr_retriever.invoke(query)
            if docs:
                return "\n\n".join(doc.page_content for doc in docs)
        except Exception:
            pass
        return ""

    def chat_message(self, user_input):
        try:
            # Retrieve relevant context from ChromaDB
            context = self._retrieve_context(user_input)

            if context:
                prompt = f"{self.system_prompt}\n\nReference context: {context}\n\nQuestion: {user_input}"
            else:
                prompt = f"{self.system_prompt}\n\nQuestion: {user_input}"

            response = self.model.generate_content(prompt)
            return response.text

        except Exception as e:
            return f"Error: {str(e)}"

    def reset_memory(self):
        # HuggingFace Inference API is mostly stateless in this implementation
        pass
