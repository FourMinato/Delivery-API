import express from "express";
import { router as index } from "./api/index";
import { router as customers } from "./api/customers";
import { router as Order } from "./api/./Ouder/Ourder";
import { riderRouter as Rider } from "./api/./Rider/Rider";
import bodyParser from "body-parser";


export const app = express();


app.use(bodyParser.text());
app.use(bodyParser.json());

app.use("/", index);
app.use("/user", customers);
app.use("/order", Order);
app.use("/rider",Rider)
