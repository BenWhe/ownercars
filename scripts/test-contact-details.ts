// Run: npm run test:contact — checks the message contact-detail filter
// against messages that must be blocked and ones that must get through.
import { checkContactDetails as c } from "../lib/messages/contactDetails.ts";
const block = [
 "Hi, is your car still for sale? If so, how long have you had it? My whatsapp 07460680493.",
 "call 07460 680 493", "+44 (0)7460-680493", "0 7 4 6 0 6 8 0 4 9 3", "ring me on 07447 123456",
 "zero seven four six zero six eight zero four nine three", "zero seven 4 six 0 6 8 0 4 9 3",
 "email me at bob@gmail.com", "bob at gmail dot com", "bob (at) hotmail (dot) co uk",
 "see https://example.com", "www.carbuyer.net", "wa.me/447460680493", "t.me/bob",
 "please WhatsApp me to finalise", "whats app me", "Whats-App", "message me on telegram",
 "my mobile is 07...", "my number: 0746", "My email - x",
 // Disguises scammers use to get a number or app past a filter
 "call 07447.464.097", "07447/464/097", "O7447464O97", "0744 7464 O97", "07447_464_097", "07447*464*097",
 "0\uFE0F\u20E37\uFE0F\u20E34\uFE0F\u20E34\uFE0F\u20E37\uFE0F\u20E34\uFE0F\u20E36\uFE0F\u20E34\uFE0F\u20E30\uFE0F\u20E39\uFE0F\u20E37\uFE0F\u20E3",
 "zero7four4seven4six4zero9seven", "+44.7447.464.097", "44/7447/464097",
 "W h a t s A p p", "W.h.a.t.s.a.p.p me", "wh@tsapp me", "wh4tsapp", "drop me a message on w.app", "T e l e g r a m",
 "find me on insta", "my gmail is harley.flynn999", "add me on hotmail",
];
const allow = [
 "Is it still available? Could I view it on 24/11/2026 13:00?",
 "Lovely car. 2009, 44,980 miles, £8,995 - would you take £8,500?",
 "One owner from new? Service history? Engine 1995cc, 170,766 miles.",
 "Message me on here with a time for a viewing",
 "Can you send the MOT through the Secure Vault please?",
 "Does the number plate come with it?",
 "Saw it on ownercars.co.uk, looks great",
 "I'm 2 hours away, could do Saturday 10am or 2pm",
 "Is the signal indicator working? The 2014 model had issues",
 "Price 8995, mileage 44980, year 2009",
 "I have two kids and one dog, need 5 seats",
 "text me on here pls",
 "Could I view on 07/12/2025 13:00?", "Viewing 07/12/2025 at 1300 ok?", "Reg 07 plate, 74,000 miles, £7,450",
 "What's appealing about it? Did you install the stereo?", "The outlook for classics is good", "Someone told me it had one owner",
 "Weight 1,450kg, 0-60 in 7.4s", "Is the 4x4 system working?", "I am a cash buyer",
];
let fail=0;
if (process.argv.includes("--list")) console.log(block, allow);
for (const t of block){const r=c(t); if(!r.blocked){fail++;console.log("MISSED:",t)}}
for (const t of allow){const r=c(t); if(r.blocked){fail++;console.log("FALSE POSITIVE:",t,r.reasons)}}
console.log(fail ? `${fail} failures` : "all passed", `(${block.length} block, ${allow.length} allow)`);
if (fail) process.exit(1);
