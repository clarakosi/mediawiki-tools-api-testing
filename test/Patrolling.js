const { assert } = require('chai');
const fixtures = require('../fixtures');
const api = require('../actionapi');

describe('The patrol action', function testEditPatrolling() {
    // disable timeouts
    this.timeout(0);

    let alice, mindy;
    const pageTitle = api.title('Patroll_');
    let edit, rc;

    before(async () => {
        [alice, mindy] = await Promise.all([
            fixtures.alice(),
            fixtures.mindy()
        ]);
    });

    it('doesn\'t allow a users to patrol their own edit', async () => {
        edit = await alice.edit(pageTitle, { text: 'One', comment: 'first' });

        const error = await alice.actionError(
            'patrol',
            {
                title: pageTitle,
                revid: edit.newrevid,
                token: await alice.token('patrol')
            },
            'POST',
        );
        assert.equal(error.code, 'permissiondenied');

        const result = await mindy.action(
            'query',
            {
                list: 'recentchanges',
                rctitle: pageTitle,
                rcprop: 'ids|flags|patrolled'
            },
        );

        rc = result.query.recentchanges[0];

        assert.equal(rc.type, 'new');
        assert.notExists(rc.autopatrolled);
        assert.notExists(rc.patrolled);
        assert.exists(rc.unpatrolled);
    });

    it('allows sysops to patrol an edit', async () => {
        const result = await mindy.action(
            'patrol',
            {
                title: pageTitle,
                revid: edit.newrevid,
                token: await mindy.token('patrol')
            },
            'POST',
        );
        assert.equal(result.patrol.rcid, rc.rcid);

        rc = (await mindy.action(
            'query',
            {
                list: 'recentchanges',
                rctitle: pageTitle,
                rcprop: 'ids|flags|patrolled'
            },
        )).query.recentchanges[0];

        assert.equal(rc.type, 'new');
        assert.exists(rc.patrolled);
        assert.notExists(rc.unpatrolled);
    });

    it('doesn\'t allow regular users to see the patrol flags', async () => {
        const error = await alice.actionError(
            'query',
            {
                list: 'recentchanges',
                rctitle: pageTitle,
                rcprop: 'ids|flags|patrolled'
            },
        );

        assert.equal(error.code, 'permissiondenied');
    });
});
