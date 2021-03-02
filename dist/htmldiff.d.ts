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
export declare function diff(before: string, after: string, className: string, dataPrefix: string): string;
