import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

import { Document } from "langchain/document";
import { CharacterTextSplitter } from "langchain/text_splitter";
const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      throw new Error("Method not allowed");
    }

    const azureOpenaiKey = process.env.AZURE_OPENAI_KEY;
    const azureOpenaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;

    const bookPath = path.resolve(__dirname, "bitcoin.pdf");

    const loader = new PDFLoader(bookPath);

    const docs = await loader.load();
    // console.log(docs);

    if (!docs || docs.length === 0) {
      console.log("No documents found.");
      return;
    }

    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 250,
      chunkOverlap: 10,
    });

    const splitDocs = await splitter.splitDocuments(docs);

    const reducedDocs = splitDocs.map((doc) => {
      const reducedMetadata = { ...doc.metadata };
      delete reducedMetadata.pdf; // Remove the 'pdf' field
      return new Document({
        pageContent: doc.pageContent,
        metadata: reducedMetadata,
      });
    });

    console.log(reducedDocs);
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-ada-002",
      chunkSize: 1,
    });
    const client = new SearchClient(
      "https://shiva-langchain-2.search.windows.net",
      "temp-demo",
      new AzureKeyCredential(
        "odLDSg1sNMCAO8nZVmwuBhYAfW9GUswsrGzihlREA1AzSeDZDVoz"
      )
    );

    const uploadResult = await client.uploadDocuments(reducedDocs);

    console.log("Successfully uploaded to DB");

    return res.status(200).json({
      result: `Uploaded to Pinecone! Before splitting: ${docs.length}, After splitting: ${splitDocs.length}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
}
