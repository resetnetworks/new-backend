import bcrypt from "bcrypt";
import argon2 from "argon2";

const shortPassword = "a".repeat(10);
const longPassword = "a".repeat(5000); // very long

async function testBcrypt(password, label) {
  const start = Date.now();
  await bcrypt.hash(password, 12);
  const end = Date.now();
  console.log(`bcrypt (${label}) → ${end - start} ms`);
}

async function testArgon2(password, label) {
  const start = Date.now();
  await argon2.hash(password);
  const end = Date.now();
  console.log(`argon2 (${label}) → ${end - start} ms`);
}

(async () => {
  console.log("---- bcrypt ----");
  await testBcrypt(shortPassword, "10 chars");
  await testBcrypt(longPassword, "5000 chars");

  console.log("\n---- argon2 ----");
  await testArgon2(shortPassword, "10 chars");
  await testArgon2(longPassword, "5000 chars");
})();