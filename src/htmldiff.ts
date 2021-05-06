/**
 * htmldiff.js is a library that compares HTML content. It creates a diff between two
 * HTML documents by combining the two documents and wrapping the differences with
 * <ins> and <del> tags. Here is a high-level overview of how the diff works.
 *
 * 1. Tokenize the before and after HTML with htmlToTokens.
 * 2. Generate a list of operations that convert the before list of tokens to the after
 *    list of tokens with calculateOperations, which does the following:
 *      a. Find all the matching blocks of tokens between the before and after lists of
 *         tokens with findMatchingBlocks. This is done by finding the single longest
 *         matching block with findMatch, then iteratively finding the next longest
 *         matching blocks that precede and follow the longest matching block.
 *      b. Determine insertions, deletions, and replacements from the matching blocks.
 *         This is done in calculateOperations.
 * 3. Render the list of operations by wrapping tokens with <ins> and <del> tags where
 *    appropriate with renderOperations.
 *
 * Example usage:
 *
 *   var htmldiff = require('htmldiff.js');
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>')
 *   == '<p>this is some <ins>more </ins>text</p>'
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>', 'diff-class')
 *   == '<p>this is some <ins class="diff-class">more </ins>text</p>'
 */

import XRegExp from 'xregexp';

const unicodeLetterExpr = XRegExp('\\p{L}|\\d');

function isEndOfTag(char: string): boolean {
  return char === '>';
}

function isStartOfTag(char: string): boolean {
  return char === '<';
}

function isWhitespace(char: string): boolean {
  return /^\s+$/.test(char);
}


const tagRegExp = /^\s*<([^!>][^>]*)>\s*$/;
/**
 * Determines if the given token is a tag.
 *
 * @param {string} token The token in question.
 *
 * @return {boolean|string} False if the token is not a tag, or the tag name otherwise.
 */
function isTag(token: string){
  const match = tagRegExp.exec(token);
  return !!match && match[1]?.trim().split(' ')[0];
}

function isntTag(token: string): boolean {
  return !isTag(token);
}

function isStartOfHTMLComment(word: string): boolean {
  return /^<!--/.test(word);
}

function isEndOfHTMLComment(word: string): boolean {
  return /-->$/.test(word);
}

// Added head and style (for style tags inside the body)
const atomicTagsRegExp = /^<(iframe|object|math|svg|script|video|head|style|a)/;

/**
 * Checks if the current word is the beginning of an atomic tag. An atomic tag is one whose
 * child nodes should not be compared - the entire tag should be treated as one token. This
 * is useful for tags where it does not make sense to insert <ins> and <del> tags.
 *
 * @param {string} word The characters of the current token read so far.
 *
 * @return {string|null} The name of the atomic tag if the word will be an atomic tag,
 *    null otherwise
 */
function isStartOfAtomicTag(word: string){
  const result = atomicTagsRegExp.exec(word);
  return result && result[1];
}

/**
 * Checks if the current word is the end of an atomic tag (i.e. it has all the characters,
 * except for the end bracket of the closing tag, such as '<iframe></iframe').
 *
 * @param {string} word The characters of the current token read so far.
 * @param {string} tag The ending tag to look for.
 *
 * @return {boolean} True if the word is now a complete token (including the end tag),
 *    false otherwise.
 */
function isEndOfAtomicTag(word: string, tag: string){
  return word.substring(word.length - tag.length - 2) === ('</' + tag);
}

/**
 * Checks if a tag is a void tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token is a void tag, false otherwise.
 */
function isVoidTag(token: string){
  return /^\s*<[^>]+\/>\s*$/.test(token);
}

/**
 * Checks if a token can be wrapped inside a tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token can be wrapped inside a tag, false otherwise.
 */
function isWrappable(token: string): boolean {
  const isImg = /^<img[\s>]/.test(token);
  return isImg || isntTag(token) || !!isStartOfAtomicTag(token) || isVoidTag(token);
}

type Token = {
  str: string;
  key: string;
  pos: number;
};

/**
 * Creates a token that holds a string and key representation. The key is used for diffing
 * comparisons and the string is used to recompose the document after the diff is complete.
 *
 * @param {string} currentWord The section of the document to create a token for.
 *
 * @return {Object} A token object with a string and key property.
 */
export function createToken(currentWord: string, currentWordPos: number): Token {
  return {
    str: currentWord,
    key: getKeyForToken(currentWord),
    pos: currentWordPos
  };
}

type Match = {
  segment: Segment;
  length: number;
  startInBefore: number;
  startInAfter: number;
  endInBefore: number;
  endInAfter: number;
  segmentStartInBefore: number;
  segmentStartInAfter: number;
  segmentEndInBefore: number;
  segmentEndInAfter: number;
};
/**
 * A Match stores the information of a matching block. A matching block is a list of
 * consecutive tokens that appear in both the before and after lists of tokens.
 *
 * @param {number} startInBefore The index of the first token in the list of before tokens.
 * @param {number} startInAfter The index of the first token in the list of after tokens.
 * @param {number} length The number of consecutive matching tokens in this block.
 * @param {Segment} segment The segment where the match was found.
 */
function makeMatch(startInBefore: number, startInAfter: number, length: number, segment: Segment): Match {
  return {
    segment: segment,
    length: length,
    startInBefore: startInBefore + segment.beforeIndex,
    startInAfter: startInAfter + segment.afterIndex,
    endInBefore: startInBefore + segment.beforeIndex + length - 1,
    endInAfter: startInAfter + segment.afterIndex + length - 1,
    segmentStartInBefore: startInBefore,
    segmentStartInAfter: startInAfter,
    segmentEndInBefore: startInBefore + length - 1,
    segmentEndInAfter: startInAfter + length - 1
  };}

/**
 * Tokenizes a string of HTML.
 *
 * @param {string} html The string to tokenize.
 *
 * @return {Array.<string>} The list of tokens.
 */
export function htmlToTokens(html: string): Token[] {
  let mode = 'char';
  let currentWord = '';
  let currentWordPos = 0;
  let currentAtomicTag = '';
  const words = [];

  const unicodeChars = Array.from(html);
  for (let charIdx = 0; charIdx < unicodeChars.length; charIdx++) {
    const char = unicodeChars[charIdx] as string;
    switch (mode){
      case 'tag': {
        const atomicTag = isStartOfAtomicTag(currentWord);
        if (atomicTag){
          mode = 'atomic_tag';
          currentAtomicTag = atomicTag;
          currentWord += char;
        } else if (isStartOfHTMLComment(currentWord)){
          mode = 'html_comment';
          currentWord += char;
        } else if (isEndOfTag(char)){
          currentWord += '>';
          words.push(createToken(currentWord, currentWordPos));
          currentWord = '';
          currentWordPos = charIdx + 1;
          if (isWhitespace(char)){
            mode = 'whitespace';
          } else {
            mode = 'char';
          }
        } else {
          currentWord += char;
        }
        break;
      }
      case 'atomic_tag':
        if (isEndOfTag(char) && isEndOfAtomicTag(currentWord, currentAtomicTag)){
          currentWord += '>';
          words.push(createToken(currentWord, currentWordPos));
          currentWord = '';
          currentWordPos = charIdx + 1;
          currentAtomicTag = '';
          mode = 'char';
        } else {
          currentWord += char;
        }
        break;
      case 'html_comment':
        currentWord += char;
        if (isEndOfHTMLComment(currentWord)){
          currentWord = '';
          currentWordPos = charIdx + 1;
          mode = 'char';
        }
        break;
      case 'char':
        if (isStartOfTag(char)){
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          currentWord = '<';
          currentWordPos = charIdx;
          mode = 'tag';
        } else if (/\s/.test(char)){
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          currentWord = char;
          currentWordPos = charIdx;
          mode = 'whitespace';
        } else if (unicodeLetterExpr.test(char)) {
          currentWord += char;
        } else if (char == '&'){
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          currentWord = char;
          currentWordPos = charIdx;
          mode = 'entity';
        } else {
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          words.push(createToken(char, charIdx));
          currentWord = '';
          currentWordPos = charIdx + 1;
        }
        break;
      case 'entity':
        if (char == ';') {
          currentWord += char;
          words.push(createToken(currentWord, currentWordPos));
          currentWord = '';
          currentWordPos = charIdx + 1;
          mode = 'char';
        }
        else {
          currentWord += char;
        }
        break;
      case 'whitespace':
        if (isStartOfTag(char)){
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          currentWord = '<';
          currentWordPos = charIdx;
          mode = 'tag';
        } else if (isWhitespace(char)){
          currentWord += char;
        } else {
          if (currentWord){
            words.push(createToken(currentWord, currentWordPos));
          }
          currentWord = '';
          charIdx--; // seek back
          currentWordPos = charIdx;
          mode = 'char';
        }
        break;
      default:
        throw new Error('Unknown mode ' + mode);
    }
  }
  if (currentWord){
    words.push(createToken(currentWord, currentWordPos));
  }
  return words;
}

/**
 * Creates a key that should be used to match tokens. This is useful, for example, if we want
 * to consider two open tag tokens as equal, even if they don't have the same attributes. We
 * use a key instead of overwriting the token because we may want to render the original string
 * without losing the attributes.
 *
 * @param {string} token The token to create the key for.
 *
 * @return {string} The identifying key that should be used to match before and after tokens.
 */
function getKeyForToken(token: string){
  // If the token is an image element, grab it's src attribute to include in the key.
  const img = /^<img.*src=['"]([^"']*)['"].*>$/.exec(token);
  if (img) {
    return `<img src="${img[1]}">`;
  }

  // If the token is an object element, grab it's data attribute to include in the key.
  const object = /^<object.*data=['"]([^"']*)['"]/.exec(token);
  if (object) {
    return `<object src="${object[1]}"></object>`; // is src supposed to be data here?
  }

  // Treat the entire anchor as needing to be compared
  const anchor = /^<a.*href=['"]([^"']*)['"]/.exec(token);
  if (anchor) {
    return token;
  }

  // If it's a video, math or svg element, the entire token should be compared except the
  // data-uuid.
  if(/^<(svg|math|video)[\s>]/.test(token)) {
    const uuid = token.indexOf('data-uuid="');
    if (uuid !== -1) {
      const start = token.slice(0, uuid);
      const end = token.slice(uuid + 44);
      return start + end;
    } else {
      return token;
    }
  }

  // If the token is an iframe element, grab it's src attribute to include in it's key.
  const iframe = /^<iframe.*src=['"]([^"']*)['"].*>/.exec(token);
  if (iframe) {
    return `<iframe src="${iframe[1]}"></iframe>`;
  }

  // If the token is any other element, just grab the tag name.
  const tagName = /<([^\s>]+)[\s>]/.exec(token);
  if (tagName){
    return `<${tagName[1]?.toLowerCase()}>`;
  }

  // Otherwise, the token is text, collapse the whitespace.
  if (token) {
    return token.replace(/(\s+|&nbsp;|&#160;)/g, ' ');
  }
  return token;
}

/**
 * Creates a map from token key to an array of indices of locations of the matching token in
 * the list of all tokens.
 *
 * @param {Array.<string>} tokens The list of tokens to be mapped.
 *
 * @return {Object} A mapping that can be used to search for tokens.
 */
export function createMap(tokens: Token[]): Record<string, number[]> {
  return tokens.reduce(
    function(map: Record<string, number[]>, token: Token, index: number) {
      if (map[token.key]){
        map[token.key]?.push(index);
      } else {
        map[token.key] = [index];
      }
      return map;
    },
    {}
  );
}

/**
 * Compares two match objects to determine if the second match object comes before or after the
 * first match object. Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
 * before m2. If the two matches criss-cross each other, a null is returned.
 *
 * @param {Match} m1 The first match object to compare.
 * @param {Match} m2 The second match object to compare.
 *
 * @return {number} Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
 *    before m2. If the two matches criss-cross each other, 0 is returned.
 */
function compareMatches(m1: Match, m2: Match): number {
  if (m2.endInBefore < m1.startInBefore && m2.endInAfter < m1.startInAfter){
    return -1;
  } else if (m2.startInBefore > m1.endInBefore && m2.startInAfter > m1.endInAfter){
    return 1;
  } else {
    return 0;
  }
}

type TreeNode = {
  value: Match;
  left: TreeNode | null;
  right: TreeNode | null;
};

function addToNode(node: TreeNode | null, match: Match): TreeNode {
  if(node){
    const position = compareMatches(node.value, match);
    if (position === -1){
      return {
        value: node.value,
        left: addToNode(node.left, match),
        right: node.right
      };
    } else if (position === 1){
      return {
        value: node.value,
        left: node.left,
        right: addToNode(node.right, match)
      };
    } else {
      return node;
    }
  } else {
    return {
      value: match,
      left: null,
      right: null
    };
  }
}

function nodeToArray(node: TreeNode | null): Match[] {
  function inOrder(n: TreeNode | null, ns: Match[]): Match[] {
    if (n){
      inOrder(n.left, ns);
      ns.push(n.value);
      inOrder(n.right, ns);
    }
    return ns;
  }

  return inOrder(node, []);
}


/**
 * Finds and returns the best match between the before and after arrays contained in the segment
 * provided.
 *
 * @param {Segment} segment The segment in which to look for a match.
 *
 * @return {Match} The best match.
 */
export function findBestMatch(segment: Segment): Match | undefined {
  const beforeTokens = segment.beforeTokens;
  const afterMap = segment.afterMap;
  let lastSpace = null;
  let bestMatch: Match | undefined;

  // Iterate through the entirety of the beforeTokens to find the best match.
  for (let beforeIndex = 0; beforeIndex < beforeTokens.length; beforeIndex++){
    let lookBehind = false;

    // If the current best match is longer than the remaining tokens, we can bail because we
    // won't find a better match.
    const remainingTokens = beforeTokens.length - beforeIndex;
    if (bestMatch && remainingTokens < bestMatch.length){
      break;
    }

    // If the current token is whitespace, make a note of it and move on. Trying to start a
    // set of matches with whitespace is not efficient because it's too prevelant in most
    // documents. Instead, if the next token yields a match, we'll see if the whitespace can
    // be included in that match.
    const beforeToken = beforeTokens[beforeIndex];
    if (beforeToken?.key === ' '){
      lastSpace = beforeIndex;
      continue;
    }

    // Check to see if we just skipped a space, if so, we'll ask getFullMatch to look behind
    // by one token to see if it can include the whitespace.
    if (lastSpace === beforeIndex - 1){
      lookBehind = true;
    }

    // If the current token is not found in the afterTokens, it won't match and we can move
    // on.
    const afterTokenLocations = beforeToken && afterMap[beforeToken.key];
    if(!afterTokenLocations){
      continue;
    }

    // For each instance of the current token in afterTokens, let's see how big of a match
    // we can build.
    afterTokenLocations.forEach(function(afterIndex: number){
      // getFullMatch will see how far the current token match will go in both
      // beforeTokens and afterTokens.
      const bestMatchLength = bestMatch ? bestMatch.length : 0;
      const m = getFullMatch(
        segment, beforeIndex, afterIndex, bestMatchLength, lookBehind);

      // If we got a new best match, we'll save it aside.
      if (m && m.length > bestMatchLength){
        bestMatch = m;
      }
    });
  }

  return bestMatch;
}

/**
 * Takes the start of a match, and expands it in the beforeTokens and afterTokens of the
 * current segment as far as it can go.
 *
 * @param {Segment} segment The segment object to search within when expanding the match.
 * @param {number} beforeStart The offset within beforeTokens to start looking.
 * @param {number} afterStart The offset within afterTokens to start looking.
 * @param {number} minLength The minimum length match that must be found.
 * @param {boolean} lookBehind If true, attempt to match a whitespace token just before the
 *    beforeStart and afterStart tokens.
 *
 * @return {Match} The full match.
 */
function getFullMatch(segment: Segment, beforeStart: number, afterStart: number, minLength: number, lookBehind: boolean): Match | null {
  const beforeTokens = segment.beforeTokens;
  const afterTokens = segment.afterTokens;

  // If we already have a match that goes to the end of the document, no need to keep looking.
  const minBeforeIndex = beforeStart + minLength;
  const minAfterIndex = afterStart + minLength;
  if(minBeforeIndex >= beforeTokens.length || minAfterIndex >= afterTokens.length){
    return null;
  }

  // If a minLength was provided, we can do a quick check to see if the tokens after that
  // length match. If not, we won't be beating the previous best match, and we can bail out
  // early.
  if (minLength){
    const nextBeforeWord = beforeTokens[minBeforeIndex]?.key;
    const nextAfterWord = afterTokens[minAfterIndex]?.key;
    if (nextBeforeWord !== nextAfterWord){
      return null;
    }
  }

  // Extend the current match as far foward as it can go, without overflowing beforeTokens or
  // afterTokens.
  let searching = true;
  let currentLength = 1;
  let beforeIndex = beforeStart + currentLength;
  let afterIndex = afterStart + currentLength;

  while (searching && beforeIndex < beforeTokens.length && afterIndex < afterTokens.length){
    const beforeWord = beforeTokens[beforeIndex]?.key;
    const afterWord = afterTokens[afterIndex]?.key;
    if (beforeWord === afterWord){
      currentLength++;
      beforeIndex = beforeStart + currentLength;
      afterIndex = afterStart + currentLength;
    } else {
      searching = false;
    }
  }

  // If we've been asked to look behind, it's because both beforeTokens and afterTokens may
  // have a whitespace token just behind the current match that was previously ignored. If so,
  // we'll expand the current match to include it.
  if (lookBehind && beforeStart > 0 && afterStart > 0){
    const prevBeforeKey = beforeTokens[beforeStart - 1]?.key;
    const prevAfterKey = afterTokens[afterStart - 1]?.key;
    if (prevBeforeKey === ' ' && prevAfterKey === ' '){
      beforeStart--;
      afterStart--;
      currentLength++;
    }
  }

  return makeMatch(beforeStart, afterStart, currentLength, segment);
}
type Segment = {
  beforeTokens: Token[];
  afterTokens: Token[];
  beforeMap: Record<string, number[]>;
  afterMap: Record<string, number[]>;
  beforeIndex: number;
  afterIndex: number;
};
/**
 * Creates segment objects from the original document that can be used to restrict the area that
 * findBestMatch and it's helper functions search to increase performance.
 *
 * @param {Array.<Token>} beforeTokens Tokens from the before document.
 * @param {Array.<Token>} afterTokens Tokens from the after document.
 * @param {number} beforeIndex The index within the before document where this segment begins.
 * @param {number} afterIndex The index within the after document where this segment behinds.
 *
 * @return {Segment} The segment object.
 */
export function createSegment(beforeTokens: Token[], afterTokens: Token[], beforeIndex: number, afterIndex: number): Segment {
  return {
    beforeTokens: beforeTokens,
    afterTokens: afterTokens,
    beforeMap: createMap(beforeTokens),
    afterMap: createMap(afterTokens),
    beforeIndex: beforeIndex,
    afterIndex: afterIndex
  };
}

/**
 * Finds all the matching blocks within the given segment in the before and after lists of
 * tokens.
 *
 * @param {Segment} The segment that should be searched for matching blocks.
 *
 * @return {Array.<Match>} The list of matching blocks in this range.
 */
export function findMatchingBlocks(segment: Segment): Match[] {
  // Create a binary search tree to hold the matches we find in order.
  let matches: TreeNode | null = null;
  let match: Match | undefined;
  const segments = [segment];
  let currSegment: Segment | undefined;

  // Each time the best match is found in a segment, zero, one or two new segments may be
  // created from the parts of the original segment not included in the match. We will
  // continue to iterate until all segments have been processed.
  while(segments.length){
    currSegment = segments.pop();
    if (currSegment) {
      match = findBestMatch(currSegment);

      if (match && match.length){
        // If there's an unmatched area at the start of the segment, create a new segment
        // from that area and throw it into the segments array to get processed.
        if (match.segmentStartInBefore > 0 && match.segmentStartInAfter > 0){
          const leftBeforeTokens = segment.beforeTokens.slice(
            0, match.segmentStartInBefore);
          const leftAfterTokens = currSegment.afterTokens.slice(0, match.segmentStartInAfter);

          segments.push(createSegment(leftBeforeTokens, leftAfterTokens,
                                      currSegment.beforeIndex, currSegment.afterIndex));
        }

        // If there's an unmatched area at the end of the segment, create a new segment from that
        // area and throw it into the segments array to get processed.
        const rightBeforeTokens = currSegment.beforeTokens.slice(match.segmentEndInBefore + 1);
        const rightAfterTokens = currSegment.afterTokens.slice(match.segmentEndInAfter + 1);
        const rightBeforeIndex = currSegment.beforeIndex + match.segmentEndInBefore + 1;
        const rightAfterIndex = currSegment.afterIndex + match.segmentEndInAfter + 1;

        if (rightBeforeTokens.length && rightAfterTokens.length){
          segments.push(createSegment(rightBeforeTokens, rightAfterTokens,
                                      rightBeforeIndex, rightAfterIndex));
        }

        matches = addToNode(matches, match);
      }
    }
  }

  return nodeToArray(matches);
}

type Operation = {
  action: 'equal' | 'insert' | 'delete' | 'replace';
  startInBefore: number;
  endInBefore?: number;
  startInAfter: number;
  endInAfter?: number;
};
/**
 * Gets a list of operations required to transform the before list of tokens into the
 * after list of tokens. An operation describes whether a particular list of consecutive
 * tokens are equal, replaced, inserted, or deleted.
 *
 * @param {Array.<string>} beforeTokens The before list of tokens.
 * @param {Array.<string>} afterTokens The after list of tokens.
 *
 * @return {Array.<Object>} The list of operations to transform the before list of
 *      tokens into the after list of tokens, where each operation has the following
 *      keys:
 *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
 *      - {number} startInBefore The beginning of the range in the list of before tokens.
 *      - {number} endInBefore The end of the range in the list of before tokens.
 *      - {number} startInAfter The beginning of the range in the list of after tokens.
 *      - {number} endInAfter The end of the range in the list of after tokens.
 */
export function calculateOperations(beforeTokens: Token[], afterTokens: Token[]): Operation[] {
  if (!beforeTokens) throw new Error('Missing beforeTokens');
  if (!afterTokens) throw new Error('Missing afterTokens');

  let positionInBefore = 0;
  let positionInAfter = 0;
  const operations: Operation[] = [];
  const segment = createSegment(beforeTokens, afterTokens, 0, 0);
  const matches = findMatchingBlocks(segment);
  matches.push(makeMatch(beforeTokens.length, afterTokens.length, 0, segment));

  matches.forEach(match => {
    let actionUpToMatchPositions: 'equal' | 'insert' | 'delete' | 'replace' | 'none'  = 'none';
    if (positionInBefore === match.startInBefore){
      if (positionInAfter !== match.startInAfter){
        actionUpToMatchPositions = 'insert';
      }
    } else {
      actionUpToMatchPositions = 'delete';
      if (positionInAfter !== match.startInAfter){
        actionUpToMatchPositions = 'replace';
      }
    }
    if (actionUpToMatchPositions !== 'none'){
      operations.push({
        action: actionUpToMatchPositions,
        startInBefore: positionInBefore,
        endInBefore: (actionUpToMatchPositions !== 'insert' ?
          match.startInBefore - 1 : undefined),
        startInAfter: positionInAfter,
        endInAfter: (actionUpToMatchPositions !== 'delete' ?
          match.startInAfter - 1 : undefined)
      });
    }
    if (match.length !== 0){
      operations.push({
        action: 'equal',
        startInBefore: match.startInBefore,
        endInBefore: match.endInBefore,
        startInAfter: match.startInAfter,
        endInAfter: match.endInAfter
      });
    }
    positionInBefore = match.endInBefore + 1;
    positionInAfter = match.endInAfter + 1;
  });

  const postProcessed: Operation[] = [];
  let lastOp = {action: 'none'};

  function isSingleWhitespace(op: Operation){
    if (op.action !== 'equal'){
      return false;
    } else if (!op.endInBefore) {
      return false;
    } else if (op.endInBefore - op.startInBefore !== 0){
      return false;
    }
    return /^\s$/.test(beforeTokens.slice(op.startInBefore, op.endInBefore + 1).toString());
  }

  operations.forEach(op => {
    if ((isSingleWhitespace(op) && lastOp.action === 'replace') ||
      (op.action === 'replace' && lastOp.action === 'replace')){
      // lastOp.endInBefore = op.endInBefore;
      // lastOp.endInAfter = op.endInAfter;
    } else {
      postProcessed.push(op);
      lastOp = op;
    }
  });
  return postProcessed;
}

/**
 * A TokenWrapper provides a utility for grouping segments of tokens based on whether they're
 * wrappable or not. A tag is considered wrappable if it is closed within the given set of
 * tokens. For example, given the following tokens:
 *
 *      ['</b>', 'this', ' ', 'is', ' ', 'a', ' ', '<b>', 'test', '</b>', '!']
 *
 * The first '</b>' is not considered wrappable since the tag is not fully contained within the
 * array of tokens. The '<b>', 'test', and '</b>' would be a part of the same wrappable segment
 * since the entire bold tag is within the set of tokens.
 *
 * TokenWrapper has a method 'combine' which allows walking over the segments to wrap them in
 * tags.
 */
type TokenNotes = {
  tokens: string[];
  notes: Array<{
    isWrappable: boolean;
    insertedTag: boolean;
  }>;
};

function TokenWrapper(tokens: string[]): TokenNotes {
  type Data = {
    notes: Array<{isWrappable: boolean, insertedTag: boolean}>;
    tagStack: Array<{tag: string, position: number}>;
  };
  return {
    tokens: tokens,
    notes: tokens.reduce<Data>(function(data: Data, token: string, index: number) {
      data.notes.push({
        isWrappable: isWrappable(token),
        insertedTag: false
      });

      const tag = !isVoidTag(token) && isTag(token);
      const lastEntry = data.tagStack[data.tagStack.length - 1];
      if (tag){
        if (lastEntry && '/' + lastEntry.tag === tag){
          data.notes[lastEntry.position]!.insertedTag = true;
          data.tagStack.pop();
        } else {
          data.tagStack.push({
            tag: tag,
            position: index
          });
        }
      }
      return data;
    }, {notes: [], tagStack: []}).notes
  };
}

type WrappableTokens = {isWrappable: boolean, tokens: string[]};

/**
 * Wraps the contained tokens in tags based on output given by a map function. Each segment of
 * tokens will be visited. A segment is a continuous run of either all wrappable
 * tokens or unwrappable tokens. The given map function will be called with each segment of
 * tokens and the resulting strings will be combined to form the wrapped HTML.
 *
 * @param {function(boolean, Array.<string>)} mapFn A function called with an array of tokens
 *      and whether those tokens are wrappable or not. The result should be a string.
 */
function combineTokenNotes(
  mapFn: (e: WrappableTokens) => string,
  tagFn: (t: string | undefined) => string,
  tokenNotes: TokenNotes
) {
  const notes = tokenNotes.notes;
  const tokens = tokenNotes.tokens.slice();
  const segments = tokens.reduce<{
    list: WrappableTokens[];
    status: boolean | null;
    lastIndex: number;
  }>(
    function(data: {list: WrappableTokens[], status: boolean | null, lastIndex: number}, token: string, index: number){
      if (notes[index]?.insertedTag){
        tokens[index] = tagFn(tokens[index]);
      }
      if (data.status === null){
        data.status = notes[index]?.isWrappable ?? false;
      }
      const status = notes[index]?.isWrappable ?? false;
      if (status !== data.status){
        data.list.push({
          isWrappable: data.status,
          tokens: tokens.slice(data.lastIndex, index)
        });
        data.lastIndex = index;
        data.status = status;
      }
      if (index === tokens.length - 1){
        data.list.push({
          isWrappable: data.status,
          tokens: tokens.slice(data.lastIndex, index + 1)
        });
      }
      return data;
    }, {list: [], status: null, lastIndex: 0}).list;

  return segments.map(mapFn).join('');
}

/**
 * Wraps and concatenates a list of tokens with a tag. Does not wrap tag tokens,
 * unless they are wrappable (i.e. void and atomic tags).
 *
 * @param {sting} tag The tag name of the wrapper tags.
 * @param {Array.<string>} content The list of tokens to wrap.
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 */
function wrap(tag: string, content: string[], opIndex: number, dataPrefix: string, className: string){
  const wrapper: TokenNotes = TokenWrapper(content);
  dataPrefix = dataPrefix ? dataPrefix + '-' : '';
  let attrs = ` data-${dataPrefix}operation-index="${opIndex}"`;
  if (className){
    attrs += ' class="' + className + '"';
  }

  return combineTokenNotes(
    function(segment: WrappableTokens){
      if (segment.isWrappable){
        const val = segment.tokens.join('');
        if (val.trim()){
          return '<' + tag + attrs + '>' + val + '</' + tag + '>';
        }
      } else {
        return segment.tokens.join('');
      }
      return '';
    },
    function(openingTag?: string){
      let dataAttrs = ' data-diff-node="' + tag + '"';
      dataAttrs += ` data-${dataPrefix}operation-index="${opIndex}"`;

      return openingTag ? openingTag.replace(/>\s*$/, dataAttrs + '$&') : '';
    },
    wrapper
  );
}

/**
 * OPS.equal/insert/delete/replace are functions that render an operation into
 * HTML content.
 *
 * @param {Object} op The operation that applies to a prticular list of tokens. Has the
 *      following keys:
 *      - {string} action One of ['replace', 'insert', 'delete', 'equal'].
 *      - {number} startInBefore The beginning of the range in the list of before tokens.
 *      - {number} endInBefore The end of the range in the list of before tokens.
 *      - {number} startInAfter The beginning of the range in the list of after tokens.
 *      - {number} endInAfter The end of the range in the list of after tokens.
 * @param {Array.<string>} beforeTokens The before list of tokens.
 * @param {Array.<string>} afterTokens The after list of tokens.
 * @param {number} opIndex The index into the list of operations that identifies the change to
 *      be rendered. This is used to mark wrapped HTML as part of the same operation.
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 *
 * @return {string} The rendering of that operation.
 */
const OPS: {
  [K in 'equal' | 'insert' | 'delete' | 'replace'] : (op: Operation, beforeTokens: Token[], afterTokens: Token[], opIndex: number, dataPrefix: string, className: string) => string
} = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  'equal': function(op: Operation, beforeTokens: Token[], afterTokens: Token[], opIndex: number, dataPrefix: string, className: string){
    const tokens = op.endInAfter ?
      afterTokens.slice(op.startInAfter, op.endInAfter + 1) :
      afterTokens.slice(op.startInAfter, 1);
    return tokens.reduce(function(prev: string, curr: Token){
      return prev + curr.str;
    }, '');
  },
  'insert': function(op: Operation, beforeTokens: Token[], afterTokens: Token[], opIndex: number, dataPrefix: string, className: string){
    const tokens = op.endInAfter ?
      afterTokens.slice(op.startInAfter, op.endInAfter + 1) :
      afterTokens.slice(op.startInAfter, 1);
    const val = tokens.map(function(token: Token){
      return token.str;
    });
    return wrap('ins', val, opIndex, dataPrefix, className);
  },
  'delete': function(op: Operation, beforeTokens: Token[], afterTokens: Token[], opIndex: number, dataPrefix: string, className: string){
    const tokens = op.endInBefore ?
      beforeTokens.slice(op.startInBefore, op.endInBefore + 1) :
      beforeTokens.slice(op.startInBefore, 1);
    const val = tokens.map(function(token: Token){
      return token.str;
    });
    return wrap('del', val, opIndex, dataPrefix, className);
  },
  'replace': function(op: Operation, beforeTokens: Token[], afterTokens: Token[], opIndex: number, dataPrefix: string, className: string){
    return OPS.delete.apply(null, [op, beforeTokens, afterTokens, opIndex, dataPrefix, className])
      + OPS.insert.apply(null, [op, beforeTokens, afterTokens, opIndex, dataPrefix, className]);
  }
};

/**
 * Renders a list of operations into HTML content. The result is the combined version
 * of the before and after tokens with the differences wrapped in tags.
 *
 * @param {Array.<string>} beforeTokens The before list of tokens.
 * @param {Array.<string>} afterTokens The after list of tokens.
 * @param {Array.<Object>} operations The list of operations to transform the before
 *      list of tokens into the after list of tokens, where each operation has the
 *      following keys:
 *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
 *      - {number} startInBefore The beginning of the range in the list of before tokens.
 *      - {number} endInBefore The end of the range in the list of before tokens.
 *      - {number} startInAfter The beginning of the range in the list of after tokens.
 *      - {number} endInAfter The end of the range in the list of after tokens.
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 *
 * @return {string} The rendering of the list of operations.
 */
export function renderOperations(beforeTokens: Token[], afterTokens: Token[], operations: Operation[], dataPrefix: string, className: string){
  return operations.reduce(function(rendering: string, op: Operation, index: number){
    return rendering + OPS[op.action](
      op, beforeTokens, afterTokens, index, dataPrefix, className);
  }, '');
}

/**
 * Compares two pieces of HTML content and returns the combined content with differences
 * wrapped in <ins> and <del> tags.
 *
 * @param {string} before The HTML content before the changes.
 * @param {string} after The HTML content after the changes.
 * @param {string} className (Optional) The class attribute to include in <ins> and <del> tags.
 * @param {string} dataPrefix (Optional) The data prefix to use for data attributes. The
 *      operation index data attribute will be named `data-${dataPrefix-}operation-index`.
 * @param {string} atomicTags (Optional) Comma separated list of atomic tag names. The
 *     list has to be in the form `tag1,tag2,...` e. g. `head,script,style`. If not used,
 *     the default list `iframe,object,math,svg,script,video,head,style` will be used.
 *
 * @return {string} The combined HTML content with differences wrapped in <ins> and <del> tags.
 */
export default function diff(before: string, after: string, className: string, dataPrefix: string){
  if (before === after) return before;

  const beforeTokens = htmlToTokens(before);
  const afterTokens = htmlToTokens(after);
  const ops = calculateOperations(beforeTokens, afterTokens);
  return renderOperations(beforeTokens, afterTokens, ops, dataPrefix, className);
}
