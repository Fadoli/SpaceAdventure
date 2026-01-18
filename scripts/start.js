/**
 * Startup Wrapper with Test Guard
 * Runs 'bun test' before loading the main application.
 */
import { spawnSync } from "bun";

console.log("\n" + "=".repeat(50));
console.log("🔍 INITIALIZING: RUNNING PRE-FLIGHT TESTS...");
console.log("=".repeat(50));

// 1. Run Tests
const testResult = spawnSync(["bun", "test"], {
    stdout: "inherit",
    stderr: "inherit",
});

if (testResult.exitCode !== 0) {
    console.log("\n" + "!".repeat(50));
    console.log("❌ TESTS FAILED. STARTUP ABORTED.");
    console.log("Please fix the errors to start the game.");
    console.log("!".repeat(50) + "\n");
    
    const stopEvents = ["SIGINT", "SIGTERM", "SIGQUIT"];
    stopEvents.forEach(event => {
        process.on(event, () => {
            process.exit(0);
        });
    });
} else {
    console.log("\n" + "=".repeat(50));
    console.log("✅ ALL TESTS PASSED. BOOTING APPLICATION...");
    console.log("=".repeat(50) + "\n");

    // 2. Load the main application
    // Using import() here ensures it only loads if tests passed
    await import("../src/server/index.js");
}

