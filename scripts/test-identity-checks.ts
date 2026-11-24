// Run: npm run test:identity — checks the sign-up name/postcode/email rules.
import { checkName, checkFullName, isLandmarkPostcode, isDisposableEmail } from "../lib/security/identityChecks.ts";

let fail = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log(`FAIL ${label}: got ${String(got)}, want ${String(want)}`); }
};

const realNames: [string, string][] = [
  ["Ben", "Wheeler"], ["Mary-Jane", "O'Brien"], ["Siân", "Llwyd"], ["Rhys", "Smyth"], ["Jean-Luc", "Picard"],
  ["Xu", "Li"], ["Ian", "Harrison"], ["Zoë", "Dvořák"], ["Anna", "Schwartz"], ["Taylor", "Mateo"],
  ["Bryn", "Knightley"], ["Jo", "Ng"], ["Sarah", "St. John"], ["Ahmed", "Al-Hassan"], ["Mark", "van der Berg"],
];
for (const [f, l] of realNames) expect(`real name ${f} ${l}`, checkName(f, l), null);

expect("single name", checkFullName("chin"), "missing");
expect("initials", checkFullName("b w"), "too_short");
expect("digits", checkName("John1", "Smith"), "invalid_characters");
expect("keyboard mash", checkName("Asdfg", "Smith"), "suspect");
expect("placeholder", checkName("Test", "User"), "suspect");
expect("same first/last", checkName("John", "John"), "suspect");
expect("no vowels", checkName("Xkcdf", "Brown"), "suspect");
expect("repeated", checkName("Aaaaa", "Brown"), "suspect");
expect("consonant run", checkName("Bcdfghk", "Brown"), "suspect");

expect("Buckingham Palace", isLandmarkPostcode("sw1a 1aa"), true);
expect("Downing St", isLandmarkPostcode("SW1A2AA"), true);
expect("real postcode", isLandmarkPostcode("EX13 5AA"), false);

expect("mailinator", isDisposableEmail("x@mailinator.com"), true);
expect("gmail", isDisposableEmail("someone@gmail.com"), false);

console.log(fail ? `${fail} failures` : "all passed");
if (fail) process.exit(1);
