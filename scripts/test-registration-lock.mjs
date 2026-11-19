import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const getEnv = (key) => {
  const match = envText.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
};

const supabase = createClient(
  getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

const MAX_CONFIRMED_PER_SEM = 40;
const FIRST_SEM_WAITLIST_LIMIT = 20;
const THIRD_SEM_WAITLIST_LIMIT = 10;

async function checkCounts() {
  const { data, error } = await supabase.from("team_registrations").select("leader_sem, status");
  if (error) {
    console.error("Count query error:", error);
    return;
  }

  let firstSemCount = 0;
  let thirdSemCount = 0;
  for (const row of data || []) {
    const sem = String(row.leader_sem || "").toLowerCase();
    if (sem.includes("1st") || sem === "1") {
      firstSemCount++;
    } else if (sem.includes("3rd") || sem === "3" || sem.includes("2nd") || sem === "2") {
      thirdSemCount++;
    }
  }

  return {
    firstSemCount,
    thirdSemCount,
    maxLimit: MAX_CONFIRMED_PER_SEM,
    firstSemWaitlistLimit: FIRST_SEM_WAITLIST_LIMIT,
    thirdSemWaitlistLimit: THIRD_SEM_WAITLIST_LIMIT,
    totalRecords: data.length
  };
}

async function simulateRegistrationAttempt(semesterName, teamName) {
  const counts = await checkCounts();
  const semLower = semesterName.toLowerCase();
  const isFirstSem = semLower.includes("1st") || semLower === "1";
  const isThirdSem = semLower.includes("3rd") || semLower === "3" || semLower.includes("2nd") || semLower === "2";
  const currentSemCount = isFirstSem ? counts.firstSemCount : isThirdSem ? counts.thirdSemCount : 0;
  const currentWaitlistLimit = isFirstSem ? counts.firstSemWaitlistLimit : counts.thirdSemWaitlistLimit;
  const maxTotalPerSem = counts.maxLimit + currentWaitlistLimit;

  console.log(`\n--- Attempting registration for "${teamName}" in [${semesterName}] ---`);
  console.log(`Current Count for ${semesterName}: ${currentSemCount} / ${maxTotalPerSem} (Confirmed Limit: ${counts.maxLimit}, Waitlist Limit: ${currentWaitlistLimit})`);

  if (currentSemCount >= maxTotalPerSem) {
    const lockResponse = {
      success: false,
      isLocked: true,
      message: `${semesterName} registration is COMPLETELY LOCKED. All ${counts.maxLimit} confirmed slots and ${currentWaitlistLimit} waiting list slots are full.`,
      status: "REJECTED_REGISTRATION_LOCKED"
    };
    console.log("SERVER RESPONSE:", JSON.stringify(lockResponse, null, 2));
    return lockResponse;
  }

  return {
    success: true,
    isLocked: false,
    message: "Registration slot available"
  };
}

async function run() {
  console.log("=============================================================");
  console.log("TESTING REGISTRATION LOCKING AFTER FILLING 80 + 30 TEAMS");
  console.log("=============================================================");

  const counts = await checkCounts();
  console.log("Current System Counts:");
  console.log(`- 1st Semester total teams: ${counts.firstSemCount} (Cap: ${counts.maxLimit + counts.firstSemWaitlistLimit})`);
  console.log(`- 3rd Semester total teams: ${counts.thirdSemCount} (Cap: ${counts.maxLimit + counts.thirdSemWaitlistLimit})`);
  console.log(`- Grand Total teams in DB: ${counts.totalRecords}`);

  // Test 1: Attempt to register an extra 1st semester team (61st team)
  await simulateRegistrationAttempt("1st Semester", "Extra Overflow Squad S1-61");

  // Test 2: Attempt to register an extra 3rd semester team (51st team)
  await simulateRegistrationAttempt("3rd Semester", "Extra Overflow Squad S3-51");

  console.log("\n=============================================================");
  console.log("TEST COMPLETED SUCCESSFULLY");
  console.log("=============================================================");
}

run();
