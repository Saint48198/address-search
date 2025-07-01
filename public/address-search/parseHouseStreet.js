/*
// The pattern to detect (and split off) a house number is:
//    a. Any number of leading blanks are ignored.
//    b. A single letter (ignore, but only ONE letter ever allowed in a house "number").
//    c. At least one digit.
//    d. If we find a period, there is no house number.  (e.g. "0.65 LN")
//    e. A single dash after the digits is ok.  (ignored).
//    f. A single letter after the digits is ok (subject to rule (b) above)
//    g. Next char MUST be a space (or end of input), else there is no house number.
//
// This lets us handle house "numbers" like
//    123    N456   789S  222-B
//
// We return JUST the numeric part of the house "number", the rest are stripped off.
*/
function parseHouseStreetFrom (input) {

   let nonDigitCount = 0;
   let text = input.trim();

   let pos1 = scanWhile (text, 0, isLetter);
   if (pos1 == 1)  ++nonDigitCount;
   if (pos1 >  1)  return noHouseNumber(text);                // rule (b)

   let pos2 = scanWhile (text, pos1, isDigit);
   if (pos2 == pos1)    return noHouseNumber(text);           // rule (c)

   if (text.charAt(pos2) == '.') return noHouseNumber(text);  // rule (d)

   let pos3 = (text.charAt(pos2) == '-' ? pos2+1 : pos2);     // rule (e)

   let pos4 = scanWhile (text, pos3, isLetter);
   if (pos4 == pos3+1) {
      if (++nonDigitCount >= 2)  return noHouseNumber(text);  // rule (f)
   }
   if (pos4 >  pos3+1)           return noHouseNumber(text);  // rule (f)

   let lastChar = text.charAt(pos4);
   /* console.log(`Returning: [${pos1},${pos2}] => ${text.substring(pos1, pos2)}`); */
   if (lastChar==' '  ||  lastChar=='') return { house: text.substring(pos1, pos2), street: text.substring(pos4+1) };
   return noHouseNumber(text);
}

function scanWhile(text, pos, callback) {
   while (true) {
      if (pos >= text.length)     return text.length;
      if (! callback(text, pos))  return pos;
      ++pos;
   }
}

function isDigit(text, pos) {
   const code = text.charCodeAt(pos);
   return (code >= 48  &&  code <= 57);
}

function isLetter(text, pos) {
   const code = text.charCodeAt(pos);
   return (code >= 65  &&  code <=90) ||  (code >= 97  &&  code <=122);
}

function noHouseNumber(text) {
   return { house: 0, street: text };
}

function assertMatch (house, street, text) {
   let r = parseHouseStreetFrom(text);
   if (r.house != house  ||  r.street != street) 
      alert(`Error: house='${house}/${r.house}', street='${street}/${r.street}', original='${text}'`);
}
