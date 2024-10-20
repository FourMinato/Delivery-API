import http from "http";
import { app } from "./app";
import dotenv from 'dotenv';

dotenv.config();

const port: number = parseInt(process.env.PORT || "3000", 10);
const host: string = "0.0.0.0";

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});