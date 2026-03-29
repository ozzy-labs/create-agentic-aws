import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 3000;

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Hello from EKS!" }));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
});
