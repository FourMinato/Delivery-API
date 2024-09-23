import express from "express";
import { router as index } from "./api/index";
import { router as customers } from "./api/customers";
import bodyParser from "body-parser";


export const app = express();


app.use(bodyParser.text());
app.use(bodyParser.json());

app.use("/", index);
app.use("/user", customers);
