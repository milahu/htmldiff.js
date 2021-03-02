import cut from "../dist/htmldiff.js";

describe('Pain Games', function(){
    var res;

    describe('When an entire sentence is replaced', function(){
        beforeEach(function(){
            res = cut('this is what I had', 'and now we have a new one');
        });

        it('should replace the whole chunk', function(){
            expect(res).to.equal('<del data-operation-index="0">this is what I had</del>' +
                    '<ins data-operation-index="0">and now we have a new one</ins>');
        });
    });
});
