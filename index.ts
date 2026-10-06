import dotenv from "dotenv";
dotenv.config();

import app from "./src/app";
import "./src/config/database";

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 [Server B: VEDA Wallet Backend] running at http://localhost:${PORT}`);
});
