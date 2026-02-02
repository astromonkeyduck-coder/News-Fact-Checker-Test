/**
 * Smart Email Name Inference
 * 
 * Extracts first names from email addresses using multiple strategies:
 * 1. Direct name matching (john.smith@ → John)
 * 2. Leet speak normalization (sc0tt@ → Scott)
 * 3. Consonant skeleton matching (mth0mpsn@ → Matt from "thompson")
 * 4. Initial + last name pattern (jsmith@ → J from initial, Smith from last)
 * 5. Token-based extraction with confidence scoring
 */

// === FIRST NAMES DATABASE ===
const FIRST_NAMES = new Set([
  // A
  'aaron', 'abby', 'abigail', 'adam', 'adrian', 'aiden', 'al', 'alex', 'alexander',
  'alice', 'allie', 'amanda', 'amber', 'amy', 'ana', 'ann', 'andrea', 'andrew', 'andy',
  'angela', 'angie', 'anna', 'annie', 'anthony', 'ant', 'aria', 'ariana', 'art', 'ashley',
  'austin', 'ava', 'avery',
  // B
  'barb', 'barry', 'beck', 'becky', 'bella', 'ben', 'benjamin', 'beth', 'betty',
  'bill', 'billy', 'blake', 'bob', 'bobby', 'brad', 'brandon', 'brian', 'brooke', 'bryce',
  // C
  'cal', 'caleb', 'cam', 'cameron', 'carl', 'carlos', 'carol', 'caroline', 'carter',
  'casey', 'cassie', 'chad', 'charlie', 'charlotte', 'chase', 'chelsea', 'chloe',
  'chris', 'christian', 'christina', 'claire', 'cole', 'colin', 'connor', 'cory',
  // D
  'dale', 'dan', 'dana', 'daniel', 'danny', 'dave', 'david', 'dean', 'debbie',
  'derek', 'diana', 'diane', 'diego', 'don', 'donna', 'doug', 'drew', 'dylan',
  // E
  'ed', 'eddie', 'eli', 'elijah', 'eliza', 'elizabeth', 'ella', 'ellen', 'ellie',
  'emily', 'emma', 'eric', 'erica', 'erin', 'ethan', 'eva', 'evan', 'eve', 'evelyn', 'evy',
  // F
  'faith', 'felix', 'finn', 'fran', 'frank', 'fred',
  // G
  'gabe', 'gabriel', 'gary', 'gavin', 'gene', 'george', 'gia', 'gina', 'glen',
  'grace', 'gracie', 'grant', 'greg', 'gus',
  // H
  'hailey', 'hank', 'hannah', 'harper', 'harry', 'hayden', 'hazel', 'heather',
  'helen', 'henry', 'holly', 'hope', 'hunter',
  // I-J
  'ian', 'iris', 'isa', 'isaac', 'isabella', 'ivy', 'jack', 'jackie', 'jackson', 'jacob',
  'jade', 'jake', 'james', 'jamie', 'jane', 'janet', 'jason', 'jay', 'jeff', 'jen',
  'jenna', 'jennifer', 'jenny', 'jeremy', 'jerry', 'jess', 'jessica', 'jill', 'jim',
  'jimmy', 'jo', 'joan', 'joe', 'joey', 'john', 'johnny', 'jon', 'jonathan', 'jordan',
  'jose', 'josh', 'joshua', 'joy', 'joyce', 'juan', 'judy', 'julia', 'julian',
  'julie', 'june', 'justin',
  // K
  'kai', 'kara', 'karen', 'karina', 'karl', 'kat', 'kate', 'katherine', 'kathy',
  'katie', 'kay', 'kayla', 'keith', 'kelly', 'ken', 'kendall', 'kevin', 'kim', 'kyle',
  // L
  'lance', 'landon', 'larry', 'laura', 'lauren', 'leah', 'lee', 'leo', 'leon',
  'leslie', 'levi', 'lewis', 'liam', 'lily', 'linda', 'lisa', 'liz', 'logan',
  'lou', 'louis', 'lucas', 'lucy', 'luis', 'luke', 'luna', 'lynn',
  // M
  'mack', 'maddie', 'madison', 'maggie', 'marc', 'maria', 'marie', 'mario', 'mark',
  'martha', 'mary', 'mason', 'matt', 'matthew', 'max', 'maya', 'megan', 'mel',
  'mia', 'michael', 'michelle', 'mike', 'miles', 'mitch', 'molly', 'morgan',
  // N
  'nancy', 'nate', 'nathan', 'neil', 'nick', 'nicole', 'nina', 'noah', 'nolan', 'nora',
  // O
  'oliver', 'olivia', 'oscar', 'owen',
  // P
  'pam', 'pat', 'patrick', 'paul', 'paula', 'penny', 'pete', 'peter', 'phil', 'phoebe',
  // Q-R
  'quinn', 'rachel', 'randy', 'ray', 'rebecca', 'rich', 'richard', 'rick', 'riley',
  'rita', 'rob', 'robbie', 'robert', 'robin', 'rod', 'roger', 'ron', 'rosa', 'rose',
  'ross', 'roy', 'ruby', 'russell', 'ruth', 'ryan',
  // S
  'sally', 'sam', 'samantha', 'samuel', 'sandy', 'sara', 'sarah', 'scott', 'sean',
  'seth', 'shane', 'sharon', 'shawn', 'shelby', 'sierra', 'sky', 'skyler', 'sofia', 'sophia',
  'sophie', 'spencer', 'stacy', 'stan', 'stella', 'steph', 'stephanie', 'steve', 'steven',
  'sue', 'summer', 'sunny', 'susan', 'sydney',
  // T
  'tammy', 'tara', 'taylor', 'ted', 'teddy', 'teddi', 'teresa', 'terry', 'tess',
  'theo', 'thomas', 'tiffany', 'tim', 'timothy', 'tina', 'todd', 'tom', 'tommy',
  'tony', 'tracy', 'travis', 'trevor', 'troy', 'tyler',
  // U-V
  'val', 'vanessa', 'vera', 'veronica', 'vic', 'vicky', 'victor', 'victoria',
  'vince', 'vincent', 'violet', 'virginia', 'vivian',
  // W
  'wade', 'walter', 'wanda', 'wayne', 'wes', 'wesley', 'whitney', 'will', 'william',
  'willie', 'wyatt',
  // X-Z
  'xavier', 'zach', 'zachary', 'zack', 'zane', 'zo', 'zoe', 'zoey'
]);

// === LAST NAMES DATABASE (common ones for skeleton matching) ===
const LAST_NAMES = {
  // Name -> First name to return (or null to use initial)
  'smith': null, 'johnson': null, 'williams': null, 'brown': null, 'jones': null,
  'garcia': null, 'miller': null, 'davis': null, 'rodriguez': null, 'martinez': null,
  'hernandez': null, 'lopez': null, 'gonzalez': null, 'wilson': null, 'anderson': null,
  'thomas': 'tom', 'taylor': null, 'moore': null, 'jackson': 'jack', 'martin': 'marty',
  'lee': null, 'perez': null, 'thompson': 'tom', 'white': null, 'harris': null,
  'sanchez': null, 'clark': null, 'ramirez': null, 'lewis': 'lou', 'robinson': 'rob',
  'walker': null, 'young': null, 'allen': 'al', 'king': null, 'wright': null,
  'scott': null, 'torres': null, 'nguyen': null, 'hill': null, 'flores': null,
  'green': null, 'adams': 'adam', 'nelson': null, 'baker': null, 'hall': null,
  'rivera': null, 'campbell': 'cam', 'mitchell': 'mitch', 'carter': null, 'roberts': 'rob',
  'gomez': null, 'phillips': 'phil', 'evans': 'evan', 'turner': null, 'diaz': null,
  'parker': null, 'cruz': null, 'edwards': 'ed', 'collins': null, 'reyes': null,
  'stewart': 'stu', 'morris': null, 'morales': null, 'murphy': null, 'cook': null,
  'rogers': null, 'gutierrez': null, 'ortiz': null, 'morgan': null, 'cooper': null,
  'peterson': 'pete', 'bailey': null, 'reed': null, 'kelly': null, 'howard': null,
  'ramos': null, 'kim': null, 'cox': null, 'ward': null, 'richardson': 'rich',
  'watson': null, 'brooks': null, 'chavez': null, 'wood': null, 'james': 'jim',
  'bennett': 'ben', 'gray': null, 'mendoza': null, 'ruiz': null, 'hughes': null,
  'price': null, 'alvarez': null, 'castillo': null, 'sanders': null, 'patel': null,
  'myers': null, 'long': null, 'ross': null, 'foster': null, 'jimenez': null
};

// === NON-NAME TOKENS (job titles, departments, etc.) ===
const NON_NAME_TOKENS = new Set([
  'info', 'admin', 'contact', 'support', 'help', 'mail', 'email', 'team', 'sales',
  'marketing', 'service', 'billing', 'account', 'accounts', 'office', 'work',
  'dev', 'ops', 'hr', 'it', 'eng', 'qa', 'fin', 'mgr', 'exec', 'ceo', 'cto', 'cfo',
  'dept', 'group', 'corp', 'inc', 'llc', 'org', 'com', 'net', 'io',
  'test', 'demo', 'temp', 'new', 'old', 'main', 'primary', 'secondary',
  'no', 'reply', 'noreply', 'donotreply', 'bounce', 'auto', 'system', 'bot',
  'newsletter', 'alerts', 'notifications', 'updates', 'news'
]);

// === COMMON LAST NAMES (don't use these as first names in fallback) ===
const COMMON_LAST_NAMES_ONLY = new Set([
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
  'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white',
  'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker', 'young',
  'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green',
  'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 'carter',
  'roberts', 'gomez', 'phillips', 'evans', 'turner', 'diaz', 'parker', 'cruz',
  'edwards', 'collins', 'reyes', 'stewart', 'morris', 'morales', 'murphy', 'cook',
  'rogers', 'gutierrez', 'ortiz', 'morgan', 'cooper', 'peterson', 'bailey', 'reed',
  'kelly', 'howard', 'ramos', 'kim', 'cox', 'ward', 'richardson', 'watson', 'brooks',
  'chavez', 'wood', 'james', 'bennett', 'gray', 'mendoza', 'ruiz', 'hughes', 'price',
  'alvarez', 'castillo', 'sanders', 'patel', 'myers', 'long', 'ross', 'foster', 'jimenez'
]);

// === LEET SPEAK SUBSTITUTIONS ===
const LEET_MAP = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a',
  '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '+': 't'
};

// === UTILITY FUNCTIONS ===

/**
 * Normalize leet speak: sc0tt → scott, nguy3n → nguyen
 */
function normalizeLeet(str) {
  return str.split('').map(c => LEET_MAP[c] || c).join('');
}

/**
 * Get consonant skeleton: thompson → thmpsn
 */
function getSkeleton(str) {
  return str.replace(/[aeiou]/gi, '');
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses a simple ratio of matching characters
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1;
  
  // Check if shorter is contained in longer
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Check skeleton match
  const skelA = getSkeleton(a);
  const skelB = getSkeleton(b);
  if (skelA === skelB) return 0.9;
  if (skelA.includes(skelB) || skelB.includes(skelA)) return 0.7;
  
  // Character overlap
  let matches = 0;
  const shorterChars = shorter.split('');
  const longerChars = longer.split('');
  for (const c of shorterChars) {
    const idx = longerChars.indexOf(c);
    if (idx !== -1) {
      matches++;
      longerChars.splice(idx, 1);
    }
  }
  return matches / longer.length;
}

/**
 * Check if string looks like gibberish (too many consonants in a row, etc.)
 */
function looksLikeGibberish(str) {
  if (!str || str.length < 2) return true;
  
  // Must have at least one vowel
  if (!/[aeiou]/i.test(str)) return true;
  
  // Vowel ratio should be reasonable (at least 25% for short strings, 20% for longer)
  const vowelCount = (str.match(/[aeiou]/gi) || []).length;
  const minRatio = str.length <= 5 ? 0.25 : 0.20;
  if (vowelCount / str.length < minRatio) return true;
  
  // No more than 3 consonants in a row (stricter)
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(str)) return true;
  
  // Looks like vowel-stripped pattern (ends in consonant cluster)
  if (/[bcdfghjklmnpqrstvwxyz]{3,}$/i.test(str)) return true;
  
  return false;
}

/**
 * Check if string could reasonably be pronounced as a name
 */
function looksPronounceable(str) {
  if (!str || str.length < 2) return false;
  
  // Count vowels
  const vowels = (str.match(/[aeiou]/gi) || []).length;
  
  // Need at least 1 vowel for every 3 characters
  if (vowels < Math.ceil(str.length / 3.5)) return false;
  
  // Should start with a letter people use for names
  // (not weird consonant clusters)
  if (/^[bcdfghjklmnpqrstvwxyz]{3,}/i.test(str)) return false;
  
  return true;
}

// === MAIN EXTRACTION FUNCTION ===

/**
 * Extract a first name from an email address
 * Returns { name: string, confidence: number } or null
 */
function inferNameFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  
  // Get local part (before @)
  const localPart = email.toLowerCase().trim().split('@')[0];
  if (!localPart || localPart.length < 2) return null;
  
  // Normalize leet speak
  const normalized = normalizeLeet(localPart);
  
  // Remove trailing numbers (disambiguation: jlee2, mike17)
  const withoutTrailingNums = normalized.replace(/\d+$/, '');
  
  // Tokenize on common delimiters
  const tokens = withoutTrailingNums.split(/[._\-+]/).filter(t => t.length >= 2);
  
  // Filter out non-name tokens
  const nameTokens = tokens.filter(t => !NON_NAME_TOKENS.has(t));
  
  let bestMatch = null;
  let bestConfidence = 0;
  
  // === STRATEGY 1: Direct first name match in tokens ===
  for (const token of nameTokens) {
    if (FIRST_NAMES.has(token)) {
      const confidence = token.length >= 4 ? 0.95 : 0.85;
      if (confidence > bestConfidence) {
        bestMatch = token;
        bestConfidence = confidence;
      }
    }
  }
  
  // === STRATEGY 2: First name hidden in string (substring) ===
  if (bestConfidence < 0.9) {
    const sortedNames = Array.from(FIRST_NAMES).sort((a, b) => b.length - a.length);
    for (const name of sortedNames) {
      // For 4+ char names, can appear anywhere
      if (name.length >= 4 && withoutTrailingNums.includes(name)) {
        const confidence = name.length >= 5 ? 0.9 : 0.8;
        if (confidence > bestConfidence) {
          bestMatch = name;
          bestConfidence = confidence;
        }
        break;
      }
      // For 3-char names, only match if at start/end of string (clear boundaries)
      if (name.length === 3) {
        // Check if at END of string (like bananaANA)
        if (withoutTrailingNums.endsWith(name)) {
          if (0.75 > bestConfidence) {
            bestMatch = name;
            bestConfidence = 0.75;
          }
        }
        // Check if at START of a token (like ISA.mrtz)
        else {
          for (const token of tokens) {
            if (token.startsWith(name) && token.length >= 3) {
              if (0.7 > bestConfidence) {
                bestMatch = name;
                bestConfidence = 0.7;
              }
              break;
            }
          }
        }
      }
    }
  }
  
  // === STRATEGY 3: Initial + Last name pattern (jsmith, arich) ===
  if (bestConfidence < 0.8 && nameTokens.length > 0) {
    const mainToken = nameTokens[0];
    
    // Check if it's initial + last name (e.g., "jsmith" = J + Smith)
    if (mainToken.length >= 5) { // Need at least 5 chars (1 initial + 4 last name)
      const initial = mainToken[0];
      const rest = mainToken.slice(1);
      const restSkeleton = getSkeleton(rest);
      
      // Require skeleton to be at least 3 chars for meaningful matching
      if (restSkeleton.length >= 3) {
        // Check against last names
        for (const [lastName, defaultFirst] of Object.entries(LAST_NAMES)) {
          const lastSkeleton = getSkeleton(lastName);
          
          // Require exact skeleton match OR very close match
          if (restSkeleton === lastSkeleton) {
            // We found an exact last name match!
            if (defaultFirst && defaultFirst.length > 1) {
              const confidence = 0.75;
              if (confidence > bestConfidence) {
                bestMatch = defaultFirst;
                bestConfidence = confidence;
              }
            }
            break;
          }
        }
      }
    }
  }
  
  // === STRATEGY 4: Skeleton matching against first names ===
  if (bestConfidence < 0.7) {
    for (const token of nameTokens) {
      const tokenSkeleton = getSkeleton(token);
      if (tokenSkeleton.length < 3) continue;
      
      for (const firstName of FIRST_NAMES) {
        const nameSkeleton = getSkeleton(firstName);
        if (tokenSkeleton === nameSkeleton) {
          const confidence = 0.7;
          if (confidence > bestConfidence) {
            bestMatch = firstName;
            bestConfidence = confidence;
          }
          break;
        }
      }
    }
  }
  
  // === STRATEGY 5: Short plausible token (fallback) ===
  // Only use if it's a known first name (not random strings!)
  if (bestConfidence < 0.5 && nameTokens.length > 0) {
    for (const token of nameTokens) {
      // Only accept tokens that are ACTUALLY in our first names database
      if (FIRST_NAMES.has(token)) {
        // But skip if it's ALSO a common last name (ambiguous)
        if (COMMON_LAST_NAMES_ONLY.has(token)) continue;
        bestMatch = token;
        bestConfidence = 0.5;
        break;
      }
    }
  }
  
  // === STRATEGY 6: Use cleaned email local part as last resort ===
  // Be very strict - only accept if it's in our first names database
  if (bestConfidence < 0.35) {
    const firstToken = withoutTrailingNums.split(/[._\-+]/)[0];
    // Only use if it's actually a known first name
    if (firstToken && FIRST_NAMES.has(firstToken)) {
      bestMatch = firstToken;
      bestConfidence = 0.35;
    }
  }
  
  // === RETURN RESULT ===
  
  // NEVER return single-character names - that's not friendly!
  if (!bestMatch || bestMatch.length < 2) {
    return null;
  }
  
  // Skip if confidence is too low
  if (bestConfidence < 0.35) {
    return null;
  }
  
  // Capitalize properly
  const capitalizedName = bestMatch.charAt(0).toUpperCase() + bestMatch.slice(1).toLowerCase();
  
  return {
    name: capitalizedName,
    confidence: bestConfidence
  };
}

/**
 * Simple wrapper that just returns the name string or null
 */
function getFirstNameFromEmail(email) {
  const result = inferNameFromEmail(email);
  return result ? result.name : null;
}

module.exports = {
  inferNameFromEmail,
  getFirstNameFromEmail,
  normalizeLeet,
  getSkeleton,
  FIRST_NAMES,
  LAST_NAMES
};
