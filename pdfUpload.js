import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { PineconeClient } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { CharacterTextSplitter } from "langchain/text_splitter";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  if (req.method === "POST") {
    console.log("Uploading book");
    const bookPath = path.resolve(__dirname, `upload/${req.file.originalname}`);

    console.log(bookPath);

    const loader = new PDFLoader(bookPath);

    const docs = await loader.load();
    console.log(docs);

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
    // console.log(splitDocs);

    // Reduce the size of the metadata for each document -- lots of useless pdf information
    const reducedDocs = splitDocs.map((doc) => {
      const reducedMetadata = { ...doc.metadata };
      delete reducedMetadata.pdf; // Remove the 'pdf' field
      return new Document({
        pageContent: doc.pageContent,
        metadata: reducedMetadata,
      });
    });

    // console.log(docs[100]);
    // console.log(splitDocs[100].metadata);
    // console.log(reducedDocs[100].metadata);

    /** STEP TWO: UPLOAD TO DATABASE */

    const client = new PineconeClient();
    console.log(process.env.PINECONE_API_KEY);

    await client.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
    // console.log(client);
    const pineconeIndex = client.Index(process.env.PINECONE_INDEX);
    const namespace = req.params.email;

    const result = await PineconeStore.fromDocuments(
      reducedDocs,
      new OpenAIEmbeddings(),
      {
        pineconeIndex,
        namespace: namespace,
      }
    );
    fs.unlink(bookPath, (err) => {
      if (err) {
        console.log("An error occurred while deleting the file");
      } else {
        console.log("File deleted successfully");
      }
    });

    console.log("Successfully uploaded to DB");
    // Modify output as needed
    return res.status(200).json({
      response: result,
      result: `Uploaded to Pinecone! Before splitting: ${docs.length}, After splitting: ${splitDocs.length}`,
    });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}

/**
 * 
 *  INSTRUCTIONS
 * 1. Run with book
        error {
        name: 'PineconeError',
        source: 'server',
        message: 'PineconeClient: Error calling upsert: PineconeError: metadata size is 140052 bytes, which exceeds the limit of 40960 bytes per vector',
        stack: ''
        }
 * 2. Explain why -- vector meta data sizes is too big.
    Language Models are often limited by the amount of text that you can pass to them. Therefore, it is neccessary to split them up into smaller chunks. LangChain provides several utilities for doing so.
        https://js.langchain.com/docs/modules/indexes/text_splitters/
        
        Play with chunk sizes... too small and you can't understand.
        Fine tune this to your liking.
        More vectors = more $$


        3. Pinecone size 1536
        https://platform.openai.com/docs/guides/embeddings/second-generation-models

    4. Upsert metadata size -- add this after split Docs
    
      // Reduce the size of the metadata for each document
  const reducedDocs = splitDocs.map(doc => {
    const reducedMetadata = { ...doc.metadata };
    delete reducedMetadata.pdf; // Remove the 'pdf' field
    return new Document({
      pageContent: doc.pageContent,
      metadata: reducedMetadata,
    });
});


 * */
