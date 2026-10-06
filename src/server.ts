import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import "./config/database";

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 [Server B: VEDA Wallet Backend] running at http://localhost:${PORT}`);
});
