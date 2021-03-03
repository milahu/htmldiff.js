declare type Token = {
    str: string;
    key: string;
};
/**
 * Creates a token that holds a string and key representation. The key is used for diffing
 * comparisons and the string is used to recompose the document after the diff is complete.
 *
 * @param {string} currentWord The section of the document to create a token for.
 *
 * @return {Object} A token object with a string and key property.
 */
export declare function createToken(currentWord: string): Token;
declare type Match = {
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
 * Tokenizes a string of HTML.
 *
 * @param {string} html The string to tokenize.
 *
 * @return {Array.<string>} The list of tokens.
 */
export declare function htmlToTokens(html: string): Token[];
/**
 * Creates a map from token key to an array of indices of locations of the matching token in
 * the list of all tokens.
 *
 * @param {Array.<string>} tokens The list of tokens to be mapped.
 *
 * @return {Object} A mapping that can be used to search for tokens.
 */
export declare function createMap(tokens: Token[]): Record<string, number[]>;
/**
 * Finds and returns the best match between the before and after arrays contained in the segment
 * provided.
 *
 * @param {Segment} segment The segment in which to look for a match.
 *
 * @return {Match} The best match.
 */
export declare function findBestMatch(segment: Segment): Match | undefined;
declare type Segment = {
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
export declare function createSegment(beforeTokens: Token[], afterTokens: Token[], beforeIndex: number, afterIndex: number): Segment;
/**
 * Finds all the matching blocks within the given segment in the before and after lists of
 * tokens.
 *
 * @param {Segment} The segment that should be searched for matching blocks.
 *
 * @return {Array.<Match>} The list of matching blocks in this range.
 */
export declare function findMatchingBlocks(segment: Segment): Match[];
declare type Operation = {
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
export declare function calculateOperations(beforeTokens: Token[], afterTokens: Token[]): Operation[];
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
export declare function renderOperations(beforeTokens: Token[], afterTokens: Token[], operations: Operation[], dataPrefix: string, className: string): string;
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
export default function diff(before: string, after: string, className: string, dataPrefix: string): string;
export {};
