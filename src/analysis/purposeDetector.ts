import { ProgramPurpose, PurposeSource } from '../types/analysis';

export interface PurposeDetectionResult {
  purpose: ProgramPurpose;
  confidence: 'high' | 'medium' | 'low';
  clues: string[];
}

const ALGORITHM_PATTERNS: Array<{
  name: string;
  keywords: RegExp[];
  codeSignatures: RegExp[];
}> = [
  {
    name: 'FCFS (First-Come, First-Served) CPU Scheduling',
    keywords: [/\bfcfs\b/i, /first[- ]come[- ]first[- ]served/i],
    codeSignatures: [
      /\bwt\s*\[\s*i\s*\]\s*=\s*wt\s*\[\s*i\s*-\s*1\s*\]\s*\+\s*bt\s*\[\s*i\s*-\s*1\s*\]/i,
      /\bburst[-_ ]?time\b/i,
      /\bwaiting[-_ ]?time\b/i,
      /\btat\b|\bturnaround\b/i
    ]
  },
  {
    name: 'Round Robin CPU Scheduling',
    keywords: [/round[- ]robin/i, /\brr\b/i],
    codeSignatures: [
      /\btime[-_ ]?quantum\b/i,
      /\bquantum\b/i,
      /\bremaining[-_ ]?time\b|\brem_bt\b/i
    ]
  },
  {
    name: 'SJF (Shortest Job First) Scheduling',
    keywords: [/\bsjf\b/i, /shortest[- ]job[- ]first/i],
    codeSignatures: [
      /\bbt\[i\]\s*>\s*bt\[j\]/i,
      /sort.*burst/i
    ]
  },
  {
    name: 'Priority CPU Scheduling',
    keywords: [/priority[- ]scheduling/i, /non[- ]?preemptive[- ]priority/i, /preemptive[- ]priority/i],
    codeSignatures: [
      /\bpriority\b/i,
      /\bprio\b/i
    ]
  },
  {
    name: 'Binary Search Algorithm',
    keywords: [/binary[- ]search/i],
    codeSignatures: [
      /\b(low|left)\s*\+\s*\((high|right)\s*-\s*(low|left)\)\s*\/\s*2/i,
      /\bmid\s*=\s*\((low|left)\s*\+\s*(high|right)\)\s*\/\s*2/i,
      /\b(low|left)\s*<=\s*(high|right)/i
    ]
  },
  {
    name: 'Merge Sort Algorithm',
    keywords: [/merge[- ]sort/i],
    codeSignatures: [
      /merge\s*\([^)]*\)/i,
      /\bmid\s*=\s*.*\/2/i,
      /left.*right.*merged/i
    ]
  },
  {
    name: 'Bubble Sort Algorithm',
    keywords: [/bubble[- ]sort/i],
    codeSignatures: [
      /\barr\[j\]\s*>\s*arr\[j\s*\+\s*1\]/i,
      /\ba\[j\]\s*>\s*a\[j\s*\+\s*1\]/i
    ]
  },
  {
    name: 'N-Queens / 4-Queens Problem',
    keywords: [/n[- ]?queens/i, /4[- ]?queens/i],
    codeSignatures: [
      /isSafe\s*\(/i,
      /solveNQ|solveNQueens/i,
      /board\[row\]\[col\]/i
    ]
  },
  {
    name: 'Linear Search Algorithm',
    keywords: [/linear[- ]search/i],
    codeSignatures: [
      /for.*arr\[i\]\s*==\s*(key|target)/i
    ]
  },
  {
    name: 'Student Grade Calculator',
    keywords: [/student[- ]grade/i, /grade[- ]calculator/i, /gpa[- ]calc/i],
    codeSignatures: [
      /\bmarks\b|\bgrades?\b|\bgpa\b/i,
      /\baverage\s*>=|\bpercentage\b/i
    ]
  },
  {
    name: 'Bank Account Management',
    keywords: [/bank[- ]account/i, /atm[- ]system/i, /banking/i],
    codeSignatures: [
      /\bdeposit\b|\bwithdraw\b|\bbalance\b/i
    ]
  }
];

export class PurposeDetector {
  /**
   * Detects program purpose following the 7 rules:
   * 1. Inspect first meaningful source line and nearby comments.
   * 2. Priority to explicit comment describing purpose.
   * 3. Inspect function/variable/code structure.
   * 4. Check for conflict/mismatch between comment and code.
   * 5. State if inferred or ask user.
   * 6. Do not assume every program implements an algorithm.
   * 7. Do not mistake comment for proof that code is correct.
   */
  public static detect(source: string, fileName?: string): PurposeDetectionResult {
    const lines = source.split(/\r?\n/);
    const clues: string[] = [];
    
    // Step 1: Extract header comments (top 15 lines)
    const headerComments: string[] = [];
    let inBlockComment = false;
    let checkedLines = 0;

    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      checkedLines++;

      if (line.startsWith('/*')) {
        inBlockComment = true;
        const cleaned = line.replace(/^\/\*\+?\s*/, '').replace(/\*\/$/, '').trim();
        if (cleaned) {
          headerComments.push(cleaned);
        }
        if (line.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (inBlockComment) {
        if (line.includes('*/')) {
          inBlockComment = false;
          const cleaned = line.replace(/\*\/$/, '').replace(/^\*\s*/, '').trim();
          if (cleaned) {
            headerComments.push(cleaned);
          }
        } else {
          const cleaned = line.replace(/^\*\s*/, '').trim();
          if (cleaned) {
            headerComments.push(cleaned);
          }
        }
        continue;
      }

      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('--')) {
        const cleaned = line.replace(/^(\/\/|#|--)\s*/, '').trim();
        if (cleaned) {
          headerComments.push(cleaned);
        }
        continue;
      }

      // Stop scanning comments once we hit real code (after first 3 statements)
      if (checkedLines > 10) {
        break;
      }
    }

    // Step 2: Check explicit comment
    let explicitPurpose: string | undefined;
    if (headerComments.length > 0) {
      for (const comment of headerComments) {
        // Skip common boilerplate like #include, license, author only
        if (/^(include|import|author|license|copyright|date|file:)/i.test(comment)) {
          continue;
        }
        // Check if comment describes an algorithm or task
        if (
          /algorithm|scheduling|sort|search|calculator|management|simulation|system|problem|game|solver/i.test(comment) ||
          comment.length > 5
        ) {
          explicitPurpose = comment;
          clues.push(`Explicit comment detected: "${comment}"`);
          break;
        }
      }
    }

    // Step 3: Inspect code signatures, functions, variables across full source
    let matchedAlgorithm: { name: string; score: number } | undefined;
    for (const algo of ALGORITHM_PATTERNS) {
      let score = 0;
      // Check fileName match
      if (fileName) {
        for (const kw of algo.keywords) {
          if (kw.test(fileName)) {
            score += 3;
            clues.push(`File name matches algorithm pattern: ${algo.name}`);
            break;
          }
        }
      }
      // Check code signature matches
      for (const sig of algo.codeSignatures) {
        if (sig.test(source)) {
          score += 2;
          clues.push(`Code signature matched for: ${algo.name}`);
        }
      }
      // Check keyword matches in full source comments/identifiers
      for (const kw of algo.keywords) {
        if (kw.test(source)) {
          score += 1;
        }
      }

      if (score >= 2 && (!matchedAlgorithm || score > matchedAlgorithm.score)) {
        matchedAlgorithm = { name: algo.name, score };
      }
    }

    // Step 4: Rule 4 - Check comment vs code mismatch
    if (explicitPurpose && matchedAlgorithm) {
      const explicitLower = explicitPurpose.toLowerCase();
      const codeAlgoLower = matchedAlgorithm.name.toLowerCase();

      // Check if comment claims an algorithm that contradicts the code's matched signatures
      const explicitWords = explicitLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      const codeWords = codeAlgoLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      
      const hasWordOverlap = explicitWords.some(w => codeWords.includes(w) && !['algorithm', 'cpu', 'scheduling', 'problem'].includes(w));

      const isMismatch = matchedAlgorithm.score >= 2 && !hasWordOverlap;

      if (isMismatch) {
        clues.push(`MISMATCH: Comment states "${explicitPurpose}", but code features align with "${matchedAlgorithm.name}"`);
        return {
          purpose: {
            purpose: `Mismatch Detected: Comment states "${explicitPurpose}", but code structure resembles "${matchedAlgorithm.name}"`,
            source: 'mismatch_detected',
            explanation: `The header comment indicates "${explicitPurpose}", but the implementation features logic corresponding to "${matchedAlgorithm.name}". This mismatch may mislead debugging efforts.`,
            isMismatch: true,
            algorithmName: matchedAlgorithm.name
          },
          confidence: 'medium',
          clues
        };
      }
    }

    // Explicit comment accepted
    if (explicitPurpose) {
      return {
        purpose: {
          purpose: explicitPurpose,
          source: 'explicit_comment',
          explanation: `Identified from explicit header comment: "${explicitPurpose}". Code will be evaluated against this intended specification.`,
          isMismatch: false,
          algorithmName: matchedAlgorithm?.name
        },
        confidence: 'high',
        clues
      };
    }

    // Inferred from code structure / filename
    if (matchedAlgorithm) {
      return {
        purpose: {
          purpose: matchedAlgorithm.name,
          source: 'inferred_code',
          explanation: `Inferred from program variables, loops, and logic structure. No explicit header comment was found.`,
          isMismatch: false,
          algorithmName: matchedAlgorithm.name
        },
        confidence: matchedAlgorithm.score >= 4 ? 'high' : 'medium',
        clues
      };
    }

    // General code inference (e.g. general utility / CLI script)
    if (fileName && fileName !== 'untitled') {
      const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        purpose: {
          purpose: `General Program / Script: ${baseName}`,
          source: 'inferred_code',
          explanation: `Inferred from file name "${fileName}". The program does not match a standard textbook algorithm; analyzing as general application logic.`,
          isMismatch: false
        },
        confidence: 'medium',
        clues: [`Inferred from filename: ${fileName}`]
      };
    }

    return {
      purpose: {
        purpose: 'Unspecified Program Purpose',
        source: 'unclear',
        explanation: 'Could not determine an explicit algorithm or stated purpose from the code comments or identifiers. Please add a top comment (e.g. "// Binary Search") or specify intended behavior.',
        isMismatch: false
      },
      confidence: 'low',
      clues: ['No comments or distinctive algorithm signatures detected']
    };
  }
}
