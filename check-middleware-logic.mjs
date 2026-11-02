import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Simulate the middleware port detection logic
function getPort(request) {
  const host = request.headers.get("host") || "";
  const port = request.nextUrl?.port || host.split(":")[1] || "";
  return port;
}

// Test cases
const testCases = [
  { host: "localhost:3000", nextUrlPort: "3000", desc: "Default port 3000" },
  { host: "localhost:3001", nextUrlPort: "3001", desc: "Judge port 3001" },
  { host: "localhost:3002", nextUrlPort: "3002", desc: "Team port 3002" },
  { host: "localhost:3003", nextUrlPort: "3003", desc: "Ops port 3003" },
  { host: "localhost", nextUrlPort: "", desc: "No port in host, no nextUrl.port" },
  { host: "localhost", nextUrlPort: "3000", desc: "No port in host, but nextUrl.port=3000" },
];

console.log("Port detection test:");
for (const tc of testCases) {
  const mockRequest = {
    headers: { get: (h) => h === "host" ? tc.host : null },
    nextUrl: { port: tc.nextUrlPort }
  };
  const port = tc.nextUrlPort || tc.host.split(":")[1] || "";
  const isJudgePort = port === "3001" || port === "4001" || port === "3011";
  console.log(`${tc.desc}: port="${port}", isJudgePort=${isJudgePort}`);
}
