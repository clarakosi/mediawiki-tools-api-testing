const { assert } = require('chai');
const fixtures = require('../fixtures');
const api = require('../actionapi');

describe('Links', function testLinks() {
    // disable timeouts
    this.timeout(0);

    const titles = (list) => list.map((p)=>api.dbkey(p.title));

    const pageX = api.title('LinkTest_X_');
    const pageY = api.title('LinkTest_Y_');
    const imageY = `File:${pageY}`;
    const urlY = `http://example.com/${pageY}`;

    // TODO: language links, interwiki links...

    let alice;

    before(async () => {
        alice = await fixtures.alice();

        const textX = `Mention a [[${pageY}|Page]], ` +
            `include an [[${imageY}]] and also link to [[:${imageY}]], ` +
            `link to a URL[${urlY}]`;

        // Do all edits in parallel.
        await Promise.all([
            alice.edit(pageX, { text: textX }),
            alice.edit(pageY, { text: 'Just some text' })
        ]);
    });

    describe('to pages', () => {
        it('can be listed', async () => {
            const result = await alice.prop('links', pageX);
            const links = titles(result[pageX].links);

            assert.sameMembers(links, [pageY, imageY]);
        });

        it('can be filtered by namespace', async () => {
            const result = await alice.prop('links', pageX, { plnamespace: 0 });
            const links = titles(result[pageX].links);

            assert.sameMembers(links, [pageY]);
        });
    });

    describe('from pages', () => {
        it('can be listed', async () => {
            const result = await alice.prop('linkshere', pageY);
            const links = titles(result[pageY].linkshere);

            assert.sameMembers(links, [pageX]);
        });
    });

    describe('to external pages', () => {
        it('can be listed', async () => {
            const result = await alice.prop('extlinks', pageX);
            const links = result[pageX].extlinks.map((p)=>p['*']);

            assert.sameMembers(links, [urlY]);
        });
    });

    describe('to media', () => {
        it('can be listed', async () => {
            const result = await alice.prop('images', pageX);
            const links = titles(result[pageX].images);

            assert.sameMembers(links, [imageY]);
        });
    });
});