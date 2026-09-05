//const TimeEdit = require("../time-edit-api");

const te = new TimeEdit(`https://cloud.timeedit.net/chalmers/web/public/`);

te.getCourseEvents('16764.10').then(results => {
    console.log(results.reservations)
});