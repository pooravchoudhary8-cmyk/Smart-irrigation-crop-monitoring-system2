#!/usr/bin/env python3
"""
Test script to verify HuggingFace API endpoint fix
"""
import os
import sys

# Set the new HuggingFace endpoint before importing
os.environ["HF_INFERENCE_ENDPOINT"] = "https://router.huggingface.co"

try:
    from langchain_huggingface import HuggingFaceEmbeddings
    print("✅ Successfully imported HuggingFaceEmbeddings")
    
    # Try to create embeddings instance
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    print("✅ Successfully created HuggingFaceEmbeddings instance")
    
    # Test embedding a simple text
    test_text = "This is a test for soil classification"
    result = embeddings.embed_query(test_text)
    print(f"✅ Successfully embedded text (dimension: {len(result)})")
    print("🎉 HuggingFace API endpoint fix is working!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
