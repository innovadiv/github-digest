let GitHubApi = require('github');

// get user and pass
let user = process.argv[2];
let pass = process.argv[3];
let debug = process.argv[4];

// out
let stdout = '';
let targetMilestones = [];

// consts
const MILESTONE_LIMIT = 4;

// api factory
let github = new GitHubApi({
    version: '3.0.0',
    debug: debug ? true : false,
    protocol: 'https',
    host: 'api.github.com',
    pathPrefix: '',
    timeout: 5000
});

// all requests require to be authenticated
github.authenticate({
    type: 'basic',
    username: user,
    password: pass
});

/**
 * Wraps `github` requests as promise
 * @param methodName
 * @param argumentName
 * @param config
 * @returns {Promise}
 */
function api(methodName, argumentName, config) {
    return new Promise((resolve, reject) => {
        github[methodName][argumentName](config, (err, res) => {
            if (err) {
                return reject(err);
            }

            // no items?
            if (res.length === 0) {
                return reject(new Error(`no response items from ${methodName}.${argumentName}`));
            }

            resolve(res);
        });
    });
}

// run
api('issues', 'getAllMilestones', {
    user: 'innovadiv',
    repo: 'innovadiv-com',
    state: 'open',
    sort: 'due_date'
}).then((milestones) => {
    return milestones
        // only care about milestones with a due date
        .filter((item) => item.due_on !== null)
        // sort asc (github api doesn't support `direction` on milestone returns)
        .reverse()
        // only care about the specified milestone limits
        .reduce((out, item, index) => {
            if (index < MILESTONE_LIMIT) {
                out.push(item);
            }

            return out;
        }, []);
}).then((milestones) => {
    targetMilestones = milestones;

    // get issues for first milestone
    return api('issues', 'repoIssues', {
        user: 'innovadiv',
        repo: 'innovadiv-com',
        milestone: targetMilestones[0].number,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 100
    });
}).then((firstMilestoneIssues) => {
    // get issues in a presentable text format
    let stdoutIssues = firstMilestoneIssues.reduce((str, issue, index) => {
        return `${str}${index > 0 ? '\n' : ''}#${issue.number} - ${issue.title.trim()} - ${issue.assignee.login}`;
    }, '');

    // iterate over milestones and output
    targetMilestones.forEach((milestone, index) => {
        // detailed report on the immediate milestone information
        if (index === 0) {
            let complete = (milestone.open_issues / (milestone.open_issues + milestone.closed_issues)) * 100;

            stdout += `*${milestone.title} milestone is* \`${complete}%\` *complete with* \`${milestone.open_issues} issues open\`\n\`\`\`${stdoutIssues}\`\`\` `;
            stdout += `${milestone.html_url}\n`
        } else { // snapshot on the next milestones
            stdout += `${milestone.title} milestone is upcoming with \`${milestone.open_issues} issues\`\n`;
        }
    });

    // write
    process.stdout.write(stdout);
});