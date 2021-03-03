var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
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
function isEndOfTag(char) {
    return char === '>';
}
function isStartOfTag(char) {
    return char === '<';
}
function isWhitespace(char) {
    return /^\s+$/.test(char);
}
var tagRegExp = /^\s*<([^!>][^>]*)>\s*$/;
/**
 * Determines if the given token is a tag.
 *
 * @param {string} token The token in question.
 *
 * @return {boolean|string} False if the token is not a tag, or the tag name otherwise.
 */
function isTag(token) {
    var _a;
    var match = tagRegExp.exec(token);
    return !!match && ((_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim().split(' ')[0]);
}
function isntTag(token) {
    return !isTag(token);
}
function isStartOfHTMLComment(word) {
    return /^<!--/.test(word);
}
function isEndOfHTMLComment(word) {
    return /-->$/.test(word);
}
// Added head and style (for style tags inside the body)
var atomicTagsRegExp = /^<(iframe|object|math|svg|script|video|head|style)/;
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
function isStartOfAtomicTag(word) {
    var result = atomicTagsRegExp.exec(word);
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
function isEndOfAtomicTag(word, tag) {
    return word.substring(word.length - tag.length - 2) === ('</' + tag);
}
/**
 * Checks if a tag is a void tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token is a void tag, false otherwise.
 */
function isVoidTag(token) {
    return /^\s*<[^>]+\/>\s*$/.test(token);
}
/**
 * Checks if a token can be wrapped inside a tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token can be wrapped inside a tag, false otherwise.
 */
function isWrappable(token) {
    var isImg = /^<img[\s>]/.test(token);
    return isImg || isntTag(token) || !!isStartOfAtomicTag(token) || isVoidTag(token);
}
/**
 * Creates a token that holds a string and key representation. The key is used for diffing
 * comparisons and the string is used to recompose the document after the diff is complete.
 *
 * @param {string} currentWord The section of the document to create a token for.
 *
 * @return {Object} A token object with a string and key property.
 */
export function createToken(currentWord) {
    return {
        str: currentWord,
        key: getKeyForToken(currentWord)
    };
}
/**
 * A Match stores the information of a matching block. A matching block is a list of
 * consecutive tokens that appear in both the before and after lists of tokens.
 *
 * @param {number} startInBefore The index of the first token in the list of before tokens.
 * @param {number} startInAfter The index of the first token in the list of after tokens.
 * @param {number} length The number of consecutive matching tokens in this block.
 * @param {Segment} segment The segment where the match was found.
 */
function makeMatch(startInBefore, startInAfter, length, segment) {
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
    };
}
/**
 * Tokenizes a string of HTML.
 *
 * @param {string} html The string to tokenize.
 *
 * @return {Array.<string>} The list of tokens.
 */
export function htmlToTokens(html) {
    var e_1, _a;
    var mode = 'char';
    var currentWord = '';
    var currentAtomicTag = '';
    var words = [];
    try {
        for (var html_1 = __values(html), html_1_1 = html_1.next(); !html_1_1.done; html_1_1 = html_1.next()) {
            var char = html_1_1.value;
            switch (mode) {
                case 'tag': {
                    var atomicTag = isStartOfAtomicTag(currentWord);
                    if (atomicTag) {
                        mode = 'atomic_tag';
                        currentAtomicTag = atomicTag;
                        currentWord += char;
                    }
                    else if (isStartOfHTMLComment(currentWord)) {
                        mode = 'html_comment';
                        currentWord += char;
                    }
                    else if (isEndOfTag(char)) {
                        currentWord += '>';
                        words.push(createToken(currentWord));
                        currentWord = '';
                        if (isWhitespace(char)) {
                            mode = 'whitespace';
                        }
                        else {
                            mode = 'char';
                        }
                    }
                    else {
                        currentWord += char;
                    }
                    break;
                }
                case 'atomic_tag':
                    if (isEndOfTag(char) && isEndOfAtomicTag(currentWord, currentAtomicTag)) {
                        currentWord += '>';
                        words.push(createToken(currentWord));
                        currentWord = '';
                        currentAtomicTag = '';
                        mode = 'char';
                    }
                    else {
                        currentWord += char;
                    }
                    break;
                case 'html_comment':
                    currentWord += char;
                    if (isEndOfHTMLComment(currentWord)) {
                        currentWord = '';
                        mode = 'char';
                    }
                    break;
                case 'char':
                    if (isStartOfTag(char)) {
                        if (currentWord) {
                            words.push(createToken(currentWord));
                        }
                        currentWord = '<';
                        mode = 'tag';
                    }
                    else if (/\s/.test(char)) {
                        if (currentWord) {
                            words.push(createToken(currentWord));
                        }
                        currentWord = char;
                        mode = 'whitespace';
                    }
                    else if (/[\w\d#@]/.test(char)) {
                        currentWord += char;
                    }
                    else if (/&/.test(char)) {
                        if (currentWord) {
                            words.push(createToken(currentWord));
                        }
                        currentWord = char;
                    }
                    else {
                        currentWord += char;
                        words.push(createToken(currentWord));
                        currentWord = '';
                    }
                    break;
                case 'whitespace':
                    if (isStartOfTag(char)) {
                        if (currentWord) {
                            words.push(createToken(currentWord));
                        }
                        currentWord = '<';
                        mode = 'tag';
                    }
                    else if (isWhitespace(char)) {
                        currentWord += char;
                    }
                    else {
                        if (currentWord) {
                            words.push(createToken(currentWord));
                        }
                        currentWord = char;
                        mode = 'char';
                    }
                    break;
                default:
                    throw new Error('Unknown mode ' + mode);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (html_1_1 && !html_1_1.done && (_a = html_1.return)) _a.call(html_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (currentWord) {
        words.push(createToken(currentWord));
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
function getKeyForToken(token) {
    var _a;
    // If the token is an image element, grab it's src attribute to include in the key.
    var img = /^<img.*src=['"]([^"']*)['"].*>$/.exec(token);
    if (img) {
        return "<img src=\"" + img[1] + "\">";
    }
    // If the token is an object element, grab it's data attribute to include in the key.
    var object = /^<object.*data=['"]([^"']*)['"]/.exec(token);
    if (object) {
        return "<object src=\"" + object[1] + "\"></object>";
    }
    // If it's a video, math or svg element, the entire token should be compared except the
    // data-uuid.
    if (/^<(svg|math|video)[\s>]/.test(token)) {
        var uuid = token.indexOf('data-uuid="');
        if (uuid !== -1) {
            var start = token.slice(0, uuid);
            var end = token.slice(uuid + 44);
            return start + end;
        }
        else {
            return token;
        }
    }
    // If the token is an iframe element, grab it's src attribute to include in it's key.
    var iframe = /^<iframe.*src=['"]([^"']*)['"].*>/.exec(token);
    if (iframe) {
        return "<iframe src=\"" + iframe[1] + "\"></iframe>";
    }
    // If the token is any other element, just grab the tag name.
    var tagName = /<([^\s>]+)[\s>]/.exec(token);
    if (tagName) {
        return "<" + ((_a = tagName[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) + ">";
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
export function createMap(tokens) {
    return tokens.reduce(function (map, token, index) {
        var _a;
        if (map[token.key]) {
            (_a = map[token.key]) === null || _a === void 0 ? void 0 : _a.push(index);
        }
        else {
            map[token.key] = [index];
        }
        return map;
    }, {});
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
function compareMatches(m1, m2) {
    if (m2.endInBefore < m1.startInBefore && m2.endInAfter < m1.startInAfter) {
        return -1;
    }
    else if (m2.startInBefore > m1.endInBefore && m2.startInAfter > m1.endInAfter) {
        return 1;
    }
    else {
        return 0;
    }
}
function addToNode(node, match) {
    if (node) {
        var position = compareMatches(node.value, match);
        if (position === -1) {
            return {
                value: node.value,
                left: addToNode(node.left, match),
                right: node.right
            };
        }
        else if (position === 1) {
            return {
                value: node.value,
                left: node.left,
                right: addToNode(node.right, match)
            };
        }
        else {
            return node;
        }
    }
    else {
        return {
            value: match,
            left: null,
            right: null
        };
    }
}
function nodeToArray(node) {
    function inOrder(n, ns) {
        if (n) {
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
export function findBestMatch(segment) {
    var beforeTokens = segment.beforeTokens;
    var afterMap = segment.afterMap;
    var lastSpace = null;
    var bestMatch;
    var _loop_1 = function (beforeIndex) {
        var lookBehind = false;
        // If the current best match is longer than the remaining tokens, we can bail because we
        // won't find a better match.
        var remainingTokens = beforeTokens.length - beforeIndex;
        if (bestMatch && remainingTokens < bestMatch.length) {
            return "break";
        }
        // If the current token is whitespace, make a note of it and move on. Trying to start a
        // set of matches with whitespace is not efficient because it's too prevelant in most
        // documents. Instead, if the next token yields a match, we'll see if the whitespace can
        // be included in that match.
        var beforeToken = beforeTokens[beforeIndex];
        if ((beforeToken === null || beforeToken === void 0 ? void 0 : beforeToken.key) === ' ') {
            lastSpace = beforeIndex;
            return "continue";
        }
        // Check to see if we just skipped a space, if so, we'll ask getFullMatch to look behind
        // by one token to see if it can include the whitespace.
        if (lastSpace === beforeIndex - 1) {
            lookBehind = true;
        }
        // If the current token is not found in the afterTokens, it won't match and we can move
        // on.
        var afterTokenLocations = beforeToken && afterMap[beforeToken.key];
        if (!afterTokenLocations) {
            return "continue";
        }
        // For each instance of the current token in afterTokens, let's see how big of a match
        // we can build.
        afterTokenLocations.forEach(function (afterIndex) {
            // getFullMatch will see how far the current token match will go in both
            // beforeTokens and afterTokens.
            var bestMatchLength = bestMatch ? bestMatch.length : 0;
            var m = getFullMatch(segment, beforeIndex, afterIndex, bestMatchLength, lookBehind);
            // If we got a new best match, we'll save it aside.
            if (m && m.length > bestMatchLength) {
                bestMatch = m;
            }
        });
    };
    // Iterate through the entirety of the beforeTokens to find the best match.
    for (var beforeIndex = 0; beforeIndex < beforeTokens.length; beforeIndex++) {
        var state_1 = _loop_1(beforeIndex);
        if (state_1 === "break")
            break;
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
function getFullMatch(segment, beforeStart, afterStart, minLength, lookBehind) {
    var _a, _b, _c, _d, _e, _f;
    var beforeTokens = segment.beforeTokens;
    var afterTokens = segment.afterTokens;
    // If we already have a match that goes to the end of the document, no need to keep looking.
    var minBeforeIndex = beforeStart + minLength;
    var minAfterIndex = afterStart + minLength;
    if (minBeforeIndex >= beforeTokens.length || minAfterIndex >= afterTokens.length) {
        return null;
    }
    // If a minLength was provided, we can do a quick check to see if the tokens after that
    // length match. If not, we won't be beating the previous best match, and we can bail out
    // early.
    if (minLength) {
        var nextBeforeWord = (_a = beforeTokens[minBeforeIndex]) === null || _a === void 0 ? void 0 : _a.key;
        var nextAfterWord = (_b = afterTokens[minAfterIndex]) === null || _b === void 0 ? void 0 : _b.key;
        if (nextBeforeWord !== nextAfterWord) {
            return null;
        }
    }
    // Extend the current match as far foward as it can go, without overflowing beforeTokens or
    // afterTokens.
    var searching = true;
    var currentLength = 1;
    var beforeIndex = beforeStart + currentLength;
    var afterIndex = afterStart + currentLength;
    while (searching && beforeIndex < beforeTokens.length && afterIndex < afterTokens.length) {
        var beforeWord = (_c = beforeTokens[beforeIndex]) === null || _c === void 0 ? void 0 : _c.key;
        var afterWord = (_d = afterTokens[afterIndex]) === null || _d === void 0 ? void 0 : _d.key;
        if (beforeWord === afterWord) {
            currentLength++;
            beforeIndex = beforeStart + currentLength;
            afterIndex = afterStart + currentLength;
        }
        else {
            searching = false;
        }
    }
    // If we've been asked to look behind, it's because both beforeTokens and afterTokens may
    // have a whitespace token just behind the current match that was previously ignored. If so,
    // we'll expand the current match to include it.
    if (lookBehind && beforeStart > 0 && afterStart > 0) {
        var prevBeforeKey = (_e = beforeTokens[beforeStart - 1]) === null || _e === void 0 ? void 0 : _e.key;
        var prevAfterKey = (_f = afterTokens[afterStart - 1]) === null || _f === void 0 ? void 0 : _f.key;
        if (prevBeforeKey === ' ' && prevAfterKey === ' ') {
            beforeStart--;
            afterStart--;
            currentLength++;
        }
    }
    return makeMatch(beforeStart, afterStart, currentLength, segment);
}
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
export function createSegment(beforeTokens, afterTokens, beforeIndex, afterIndex) {
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
export function findMatchingBlocks(segment) {
    // Create a binary search tree to hold the matches we find in order.
    var matches = null;
    var match;
    var segments = [segment];
    var currSegment;
    // Each time the best match is found in a segment, zero, one or two new segments may be
    // created from the parts of the original segment not included in the match. We will
    // continue to iterate until all segments have been processed.
    while (segments.length) {
        currSegment = segments.pop();
        if (currSegment) {
            match = findBestMatch(currSegment);
            if (match && match.length) {
                // If there's an unmatched area at the start of the segment, create a new segment
                // from that area and throw it into the segments array to get processed.
                if (match.segmentStartInBefore > 0 && match.segmentStartInAfter > 0) {
                    var leftBeforeTokens = segment.beforeTokens.slice(0, match.segmentStartInBefore);
                    var leftAfterTokens = currSegment.afterTokens.slice(0, match.segmentStartInAfter);
                    segments.push(createSegment(leftBeforeTokens, leftAfterTokens, currSegment.beforeIndex, currSegment.afterIndex));
                }
                // If there's an unmatched area at the end of the segment, create a new segment from that
                // area and throw it into the segments array to get processed.
                var rightBeforeTokens = currSegment.beforeTokens.slice(match.segmentEndInBefore + 1);
                var rightAfterTokens = currSegment.afterTokens.slice(match.segmentEndInAfter + 1);
                var rightBeforeIndex = currSegment.beforeIndex + match.segmentEndInBefore + 1;
                var rightAfterIndex = currSegment.afterIndex + match.segmentEndInAfter + 1;
                if (rightBeforeTokens.length && rightAfterTokens.length) {
                    segments.push(createSegment(rightBeforeTokens, rightAfterTokens, rightBeforeIndex, rightAfterIndex));
                }
                matches = addToNode(matches, match);
            }
        }
    }
    return nodeToArray(matches);
}
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
export function calculateOperations(beforeTokens, afterTokens) {
    if (!beforeTokens)
        throw new Error('Missing beforeTokens');
    if (!afterTokens)
        throw new Error('Missing afterTokens');
    var positionInBefore = 0;
    var positionInAfter = 0;
    var operations = [];
    var segment = createSegment(beforeTokens, afterTokens, 0, 0);
    var matches = findMatchingBlocks(segment);
    matches.push(makeMatch(beforeTokens.length, afterTokens.length, 0, segment));
    matches.forEach(function (match) {
        var actionUpToMatchPositions = 'none';
        if (positionInBefore === match.startInBefore) {
            if (positionInAfter !== match.startInAfter) {
                actionUpToMatchPositions = 'insert';
            }
        }
        else {
            actionUpToMatchPositions = 'delete';
            if (positionInAfter !== match.startInAfter) {
                actionUpToMatchPositions = 'replace';
            }
        }
        if (actionUpToMatchPositions !== 'none') {
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
        if (match.length !== 0) {
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
    var postProcessed = [];
    var lastOp = { action: 'none' };
    function isSingleWhitespace(op) {
        if (op.action !== 'equal') {
            return false;
        }
        else if (!op.endInBefore) {
            return false;
        }
        else if (op.endInBefore - op.startInBefore !== 0) {
            return false;
        }
        return /^\s$/.test(beforeTokens.slice(op.startInBefore, op.endInBefore + 1).toString());
    }
    operations.forEach(function (op) {
        if ((isSingleWhitespace(op) && lastOp.action === 'replace') ||
            (op.action === 'replace' && lastOp.action === 'replace')) {
            // lastOp.endInBefore = op.endInBefore;
            // lastOp.endInAfter = op.endInAfter;
        }
        else {
            postProcessed.push(op);
            lastOp = op;
        }
    });
    return postProcessed;
}
function TokenWrapper(tokens) {
    return {
        tokens: tokens,
        notes: tokens.reduce(function (data, token, index) {
            data.notes.push({
                isWrappable: isWrappable(token),
                insertedTag: false
            });
            var tag = !isVoidTag(token) && isTag(token);
            var lastEntry = data.tagStack[data.tagStack.length - 1];
            if (tag) {
                if (lastEntry && '/' + lastEntry.tag === tag) {
                    data.notes[lastEntry.position].insertedTag = true;
                    data.tagStack.pop();
                }
                else {
                    data.tagStack.push({
                        tag: tag,
                        position: index
                    });
                }
            }
            return data;
        }, { notes: [], tagStack: [] }).notes
    };
}
/**
 * Wraps the contained tokens in tags based on output given by a map function. Each segment of
 * tokens will be visited. A segment is a continuous run of either all wrappable
 * tokens or unwrappable tokens. The given map function will be called with each segment of
 * tokens and the resulting strings will be combined to form the wrapped HTML.
 *
 * @param {function(boolean, Array.<string>)} mapFn A function called with an array of tokens
 *      and whether those tokens are wrappable or not. The result should be a string.
 */
function combineTokenNotes(mapFn, tagFn, tokenNotes) {
    var notes = tokenNotes.notes;
    var tokens = tokenNotes.tokens.slice();
    var segments = tokens.reduce(function (data, token, index) {
        var _a, _b, _c, _d, _e;
        if ((_a = notes[index]) === null || _a === void 0 ? void 0 : _a.insertedTag) {
            tokens[index] = tagFn(tokens[index]);
        }
        if (data.status === null) {
            data.status = (_c = (_b = notes[index]) === null || _b === void 0 ? void 0 : _b.isWrappable) !== null && _c !== void 0 ? _c : false;
        }
        var status = (_e = (_d = notes[index]) === null || _d === void 0 ? void 0 : _d.isWrappable) !== null && _e !== void 0 ? _e : false;
        if (status !== data.status) {
            data.list.push({
                isWrappable: data.status,
                tokens: tokens.slice(data.lastIndex, index)
            });
            data.lastIndex = index;
            data.status = status;
        }
        if (index === tokens.length - 1) {
            data.list.push({
                isWrappable: data.status,
                tokens: tokens.slice(data.lastIndex, index + 1)
            });
        }
        return data;
    }, { list: [], status: null, lastIndex: 0 }).list;
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
function wrap(tag, content, opIndex, dataPrefix, className) {
    var wrapper = TokenWrapper(content);
    dataPrefix = dataPrefix ? dataPrefix + '-' : '';
    var attrs = " data-" + dataPrefix + "operation-index=\"" + opIndex + "\"";
    if (className) {
        attrs += ' class="' + className + '"';
    }
    return combineTokenNotes(function (segment) {
        if (segment.isWrappable) {
            var val = segment.tokens.join('');
            if (val.trim()) {
                return '<' + tag + attrs + '>' + val + '</' + tag + '>';
            }
        }
        else {
            return segment.tokens.join('');
        }
        return '';
    }, function (openingTag) {
        var dataAttrs = ' data-diff-node="' + tag + '"';
        dataAttrs += " data-" + dataPrefix + "operation-index=\"" + opIndex + "\"";
        return openingTag ? openingTag.replace(/>\s*$/, dataAttrs + '$&') : '';
    }, wrapper);
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
var OPS = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    'equal': function (op, beforeTokens, afterTokens, opIndex, dataPrefix, className) {
        var tokens = op.endInAfter ?
            afterTokens.slice(op.startInAfter, op.endInAfter + 1) :
            afterTokens.slice(op.startInAfter, 1);
        return tokens.reduce(function (prev, curr) {
            return prev + curr.str;
        }, '');
    },
    'insert': function (op, beforeTokens, afterTokens, opIndex, dataPrefix, className) {
        var tokens = op.endInAfter ?
            afterTokens.slice(op.startInAfter, op.endInAfter + 1) :
            afterTokens.slice(op.startInAfter, 1);
        var val = tokens.map(function (token) {
            return token.str;
        });
        return wrap('ins', val, opIndex, dataPrefix, className);
    },
    'delete': function (op, beforeTokens, afterTokens, opIndex, dataPrefix, className) {
        var tokens = op.endInBefore ?
            beforeTokens.slice(op.startInBefore, op.endInBefore + 1) :
            beforeTokens.slice(op.startInBefore, 1);
        var val = tokens.map(function (token) {
            return token.str;
        });
        return wrap('del', val, opIndex, dataPrefix, className);
    },
    'replace': function (op, beforeTokens, afterTokens, opIndex, dataPrefix, className) {
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
export function renderOperations(beforeTokens, afterTokens, operations, dataPrefix, className) {
    return operations.reduce(function (rendering, op, index) {
        return rendering + OPS[op.action](op, beforeTokens, afterTokens, index, dataPrefix, className);
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
export default function diff(before, after, className, dataPrefix) {
    if (before === after)
        return before;
    var beforeTokens = htmlToTokens(before);
    var afterTokens = htmlToTokens(after);
    var ops = calculateOperations(beforeTokens, afterTokens);
    return renderOperations(beforeTokens, afterTokens, ops, dataPrefix, className);
}
//# sourceMappingURL=htmldiff.js.map