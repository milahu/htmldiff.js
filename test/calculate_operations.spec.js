import {calculateOperations, htmlToTokens} from "../dist/htmldiff.js";

// Calculates the differences into a list of edit operations.
describe('calculateOperations', function(){
  var res;

  it('should be a function', function(){
    expect(calculateOperations).is.a('function');
  });

  describe('Actions', function(){
    describe('In the middle', function(){
      describe('Replace', function(){
        beforeEach(function(){
          var before = htmlToTokens('working on it');
          var after = htmlToTokens('working in it');
          res = calculateOperations(before, after);
        });

        it('should result in 3 operations', function(){
          expect(res.length).to.equal(3);
        });

        it('should replace "on"', function(){
          expect(res[1]).eql({
            action          : 'replace',
            startInBefore   : 2,
            endInBefore     : 2,
            startInAfter    : 2,
            endInAfter      : 2
          });
        });
      });

      describe('Insert', function(){
        beforeEach(function(){
          var before = htmlToTokens('working it');
          var after = htmlToTokens('working in it');
          res = calculateOperations(before, after);
        });

        it('should result in 3 operations', function(){
          expect(res.length).to.equal(3);
        });

        it('should show an insert for "on"', function(){
          expect(res[1]).eql({
            action          : 'insert',
            startInBefore   : 2,
            endInBefore     : undefined,
            startInAfter    : 2,
            endInAfter      : 3
          });
        });

        describe('More than one word', function(){
          beforeEach(function(){
            var before = htmlToTokens('working it');
            var after =  htmlToTokens('working all up on it');
            res = calculateOperations(before, after);
          });

          it('should still have 3 operations', function(){
            expect(res.length).to.equal(3);
          });

          it('should show a big insert', function(){
            expect(res[1]).eql({
              action          : 'insert',
              startInBefore   : 2,
              endInBefore     : undefined,
              startInAfter    : 2,
              endInAfter      : 7
            });
          });
        });
      });

      describe('Delete', function(){
        beforeEach(function(){
          var before = htmlToTokens('this is a lot of text');
          var after = htmlToTokens('this is text');
          res = calculateOperations(before, after);
        });

        it('should return 3 operations', function(){
          expect(res.length).to.equal(3);
        });

        it('should show the delete in the middle', function(){
          expect(res[1]).eql({
            action          : 'delete',
            startInBefore   : 4,
            endInBefore     : 9,
            startInAfter    : 4,
            endInAfter      : undefined
          });
        });
      });

      describe('Equal', function(){
        beforeEach(function(){
          var before = htmlToTokens('this is what it sounds like');
          var after = htmlToTokens('this is what it sounds like');
          res = calculateOperations(before, after);
        });

        it('should return a single op', function(){
          expect(res.length).to.equal(1);
          expect(res[0]).eql({
            action          : 'equal',
            startInBefore   : 0,
            endInBefore     : 10,
            startInAfter    : 0,
            endInAfter      : 10
          });
        });
      });
    });

    describe('At the beginning', function(){
      describe('Replace', function(){
        beforeEach(function(){
          var before = htmlToTokens('I dont like veggies');
          var after = htmlToTokens('Joe loves veggies');
          res = calculateOperations(before, after);
        });

        it('should return 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have a replace at the beginning', function(){
          expect(res[0]).eql({
            action          : 'replace',
            startInBefore   : 0,
            endInBefore     : 4,
            startInAfter    : 0,
            endInAfter      : 2
          });
        });
      });

      describe('Insert', function(){
        beforeEach(function(){
          var before = htmlToTokens('dog');
          var after = htmlToTokens('the shaggy dog');
          res = calculateOperations(before, after);
        });

        it('should return 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have an insert at the beginning', function(){
          expect(res[0]).eql({
            action          : 'insert',
            startInBefore   : 0,
            endInBefore     : undefined,
            startInAfter    : 0,
            endInAfter      : 3
          });
        });
      });

      describe('Delete', function(){
        beforeEach(function(){
          var before = htmlToTokens('awesome dog barks');
          var after = htmlToTokens('dog barks');
          res = calculateOperations(before, after);
        });

        it('should return 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have a delete at the beginning', function(){
          expect(res[0]).eql({
            action          : 'delete',
            startInBefore   : 0,
            endInBefore     : 1,
            startInAfter    : 0,
            endInAfter      : undefined
          });
        });
      });
    });

    describe('At the end', function(){
      describe('Replace', function(){
        beforeEach(function(){
          var before = htmlToTokens('the dog bit the cat');
          var after = htmlToTokens('the dog bit a bird');
          res = calculateOperations(before, after);
        });

        it('should return 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have a replace at the end', function(){
          expect(res[1]).eql({
            action          : 'replace',
            startInBefore   : 6,
            endInBefore     : 8,
            startInAfter    : 6,
            endInAfter      : 8
          });
        });
      });

      describe('Insert', function(){
        beforeEach(function(){
          var before = htmlToTokens('this is a dog');
          var after = htmlToTokens('this is a dog that barks');
          res = calculateOperations(before, after);
        });

        it('should return 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have an Insert at the end', function(){
          expect(res[1]).eql({
            action          : 'insert',
            startInBefore   : 7,
            endInBefore     : undefined,
            startInAfter    : 7,
            endInAfter      : 10
          });
        });
      });

      describe('Delete', function(){
        beforeEach(function(){
          var before = htmlToTokens('this is a dog that barks');
          var after = htmlToTokens('this is a dog');
          res = calculateOperations(before, after);
        });

        it('should have 2 operations', function(){
          expect(res.length).to.equal(2);
        });

        it('should have a delete at the end', function(){
          expect(res[1]).eql({
            action          : 'delete',
            startInBefore   : 7,
            endInBefore     : 10,
            startInAfter    : 7,
            endInAfter      : undefined
          });
        });
      });
    });
  });

  describe('Action Combination', function(){
    describe('dont absorb non-single-whitespace tokens', function(){
      beforeEach(function(){
        var before = htmlToTokens('I  am awesome');
        var after = htmlToTokens('You  are great');
        res = calculateOperations(before, after);
      });

      it('should return 3 actions', function(){
        expect(res.length).to.equal(1);
      });

      it('should have a replace first', function(){
        expect(res[0].action).to.equal('replace');
      });
    });
  });
});
