const { assert } = require('chai');
const fixtures = require('../fixtures');
const api = require('../actionapi');

describe('The edit action', function testEditAction() {
    let alice;

    before(async () => {
        alice = await fixtures.alice();
    });

    const pageA = api.title('Edit_A_');
    const edits = {};

    const testEditAndLog = async (page, user) => {
        const edit = await user.edit(page, {
            text: api.uniq(),
            summary: api.uniq()
        });

        const rev1 = await user.getRevision(page);
        assert.equal(rev1.revid, edit.newrevid);
        assert.equal(rev1.user, edit.param_user);
        assert.equal(rev1.comment, edit.param_summary);
        assert.equal(rev1.timestamp, edit.newtimestamp);
        assert.equal(rev1.slots.main['*'], edit.param_text);

        const rc1 = await user.getChangeEntry({ rctitle: page });
        assert.equal(rc1.type, edit.oldrevid ? 'edit' : 'new');
        assert.equal(rc1.revid, edit.newrevid);
        assert.equal(rc1.user, edit.param_user);
        assert.equal(rc1.comment, edit.param_summary);
        assert.equal(rc1.timestamp, edit.newtimestamp);

        const html1 = await user.getHtml(page);
        assert.include(html1, edit.param_text);

        return edit;
    };

    it('allows a page to be created and modified by a logged in user', async () => {
        edits.pageA1 = await testEditAndLog(pageA, alice);
        edits.pageA2 = await testEditAndLog(pageA, alice);
    });

    it('allows a page to be created and modified by an anonymous user', async () => {
        const title = api.title();
        const anon = new api.Client();
        const { name } = await anon.meta('userinfo', {});
        anon.username = name;

        await testEditAndLog(title, anon);
    });

    it('skips redundant edit', async () => {
        const result = await alice.edit(pageA, {
            text: edits.pageA2.param_text,
            summary: 'some new fancy comment'
        });

        assert.notExists(result.newrevid);
        assert.exists(result.nochange);
    });

    it('logs page creation', async () => {
        const log = await alice.getLogEntry({ letitle: pageA, letype: 'create' });

        assert.equal(log.action, 'create');
        assert.equal(log.user, edits.pageA1.param_user);
        assert.equal(log.comment, edits.pageA1.param_summary);
        assert.equal(log.timestamp, edits.pageA1.newtimestamp);
    });

    it('applies pre-save transform', async () => {
        await alice.edit(pageA, {
            text: 'Hi -- ~~~~',
            summary: 'test signature'
        });

        const rev = await alice.getRevision(pageA);
        assert.notMatch(rev.slots.main['*'], /~~~~/);
        assert.match(rev.slots.main['*'], /Alice/);
    });

    it('enforces the createonly and nocreate flags', async () => {
        const pageB = api.title('Edit_B_');

        const error1 = await alice.actionError('edit', {
            title: pageB,
            token: await alice.token('csrf'),
            text: 'Updated content',
            summary: 'update',
            nocreate: true
        }, 'POST');

        assert.equal(error1.code, 'missingtitle');

        await alice.edit(pageB, {
            text: 'Initial content',
            summary: 'create',
            createonly: true
        });

        const error2 = await alice.actionError('edit', {
            title: pageB,
            token: await alice.token('csrf'),
            text: 'Initial content again',
            summary: 'create again',
            createonly: true
        }, 'POST');

        assert.equal(error2.code, 'articleexists');

        await alice.edit(pageB, {
            text: 'Updated content',
            summary: 'update',
            nocreate: true
        });
    });

    it('allows bots to set the bot flag (or not)', async () => {
        const robby = await fixtures.robby();

        await robby.edit(pageA, {
            text: 'Bot content',
            summary: 'botting',
            bot: true
        });

        const rc1 = await alice.getChangeEntry({ rctitle: pageA });
        assert.exists(rc1.bot);

        await robby.edit(pageA, {
            text: 'Not bot content',
            summary: 'not botting'
        });

        const rc2 = await alice.getChangeEntry({ rctitle: pageA });
        assert.notExists(rc2.bot);
    });

    it('does not allow regular users to set the bot flag', async () => {
        await alice.edit(pageA, {
            text: 'Fake bot content',
            summary: 'fake botting',
            bot: true
        });

        const rc1 = await alice.getChangeEntry({ rctitle: pageA });
        assert.notExists(rc1.bot);
    });

    it('allows users to set the minor flag', async () => {
        await alice.edit(pageA, {
            text: 'Minor content',
            summary: 'minor change',
            minor: true
        });

        const rev1 = await alice.getRevision(pageA);
        assert.exists(rev1.minor);

        const rc1 = await alice.getChangeEntry({ rctitle: pageA });
        assert.exists(rc1.minor);
    });

    it('does not allow anon users to set the minor flag', async () => {
        const anon = new api.Client();
        await anon.edit(pageA, {
            text: 'Anon minor content',
            summary: 'anon minor change',
            minor: true
        });

        const rev1 = await alice.getRevision(pageA);
        assert.notExists(rev1.minor);

        const rc1 = await alice.getChangeEntry({ rctitle: pageA });
        assert.notExists(rc1.minor);
    });
});
