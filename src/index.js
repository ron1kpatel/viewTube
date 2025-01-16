import { app } from "./app.js";
import dotenv from "dotenv";
import connectDB from "./db/index.js";

// Load .env file from the src directory
dotenv.config({ path: "./src/.env" });


connectDB().then(() => {
    const PORT = process.env.PORT || 8000;
    const HOST_URL = process.env.HOST_URL;

    app.listen(PORT, () => {
        console.log(`Server is running on ${HOST_URL}:${PORT}`);
    });
}).catch((err) => {
    console.log("Database connection failure, ERROR: ", err)
})

