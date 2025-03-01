// Ensure D3.js is available
if (typeof d3 === "undefined") {
    console.error("D3.js is not loaded. Heatmap cannot be rendered.");
}

// Extract username from the URL
const username = window.location.pathname.split("/").pop();
if (!username) {
    console.error("Could not detect Codeforces username.");
}

function findProblemURL(contestId,index){
    if(contestId && contestId.toString().length<=4){
      return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
    }else{
      return `https://codeforces.com/problemset/gymProblem/${contestId}/${index}`;
    }
}

// Cache API response
let submissionCache = {};


// CF Rating Color Mapping
const ratingColors = [
    { min: 3000, color: 'rgba(170,0,0,0.9)', len: 6, idx: 0},
    { min: 2600, color: 'rgb(255, 0, 0)', len: 4, idx: 1}, //rgba(200, 0, 0, 0.9)
    { min: 2400, color: 'rgba(255, 100, 100, 0.9)', len: 2, idx: 2},
    { min: 2300, color: 'rgba(255,187,85,0.9)', len: 1, idx: 3},
    { min: 2100, color: 'rgba(255,204,136,0.9)', len: 2, idx: 4},
    { min: 1900, color: 'rgba(255, 85, 255, 0.9)', len: 2, idx: 5}, //rgba(255,136,255,0.9)
    { min: 1600, color: 'rgba(170,170,255,0.9)', len: 3, idx: 6},// rgba(120, 120, 255, 0.9)
    { min: 1400, color: 'rgba(119,221,187,0.9)', len: 2, idx: 7},
    { min: 1200, color: 'rgba(119,255,119,0.9)', len: 2, idx: 8},
    { min: 0, color: 'rgba(204,204,204,0.9)', len: 12, idx: 9}
];

async function fetchSubmissionData() {
    if (Object.keys(submissionCache).length > 0) {
        return submissionCache;
    }
    try {
        let response = await fetch(`https://codeforces.com/api/user.status?handle=${username}&status=OK`);
        let data = await response.json();
        if (!response.ok || data.status !== "OK") throw new Error("API error");

        data.result.forEach(sub => {
            let date = new Date(sub.creationTimeSeconds * 1000);
            let year = date.getFullYear();
            let formattedDate = date.toLocaleDateString("en-CA");
            let problemRating = sub.problem.rating || 0;
            let problemName = sub.problem.name;
            let problemLink = findProblemURL(sub.contestId,sub.problem.index);

            if (sub.verdict === "OK") {
                if (!submissionCache[year]) submissionCache[year] = {};
                if (!submissionCache[year][formattedDate]) {
                    submissionCache[year][formattedDate] = { problems: [] };
                }
                // Brute force duplicate check per day. This is fine since the number of problems solved per day is small
                if (!submissionCache[year][formattedDate].problems.some(p => p.name === problemName)) {
                    submissionCache[year][formattedDate].problems.push({
                        rating: problemRating,
                        name: problemName,
                        link: problemLink
                     });
                }
            }
        });
        return submissionCache;
    } catch (error) {
        console.error("Error fetching data:", error);
        return {};
    }
}

// Create tooltip
let tooltip = d3.select("body").append("div")
    .attr("id", "heatmap-tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("padding", "8px")
    .style("border-radius", "5px")
    .style("font-size", "12px")
    .style("max-width", "250px")
    .style("z-index", "1000")
    .style("pointer-events", "auto") // Allow tooltip to be hovered over
    .on("mouseover", function () { 
        tooltip.style("visibility", "visible"); 
    })
    .on("mouseout", function () { 
        tooltip.style("visibility", "hidden"); 
    });


function createHeatmap(year) {
    console.log(`Initializing heatmap for ${year}`);

    let width = 850, height = 180, cellSize = 15;
    let startDate = new Date(year, 0, 1);
    let endDate = new Date(year+1, 0, 1);
    let dates = d3.timeDays(startDate, endDate);
    let parseDate = d3.timeFormat("%Y-%m-%d");

    d3.select("#cf-heatmap-container").remove();

    let container = d3.select("#pageContent").append("div")
        .attr("id", "cf-heatmap-container")
        .style("margin-top", "20px")
        .style("padding", "10px")
        .style("background", "white")
        .style("border-radius", "10px")
        .style("box-shadow", "0px 0px 5px rgba(0, 0, 0, 0.2)")
        .style("display", "flex")
        .style("flex-direction", "column");

    let yearSelectContainer = container.append("div")
        .style("display", "flex")
        .style("justify-content", "flex-end")
        .style("width", "100%");

    let yearSelect = yearSelectContainer.append("select")
        .style("margin-bottom", "10px")
        .style("padding", "5px")
        .style("font-size", "14px")
        .on("change", function () { renderHeatmap(parseInt(this.value)); });

    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 2015; y--) {
        yearSelect.append("option").attr("value", y).text(y);
    }
    yearSelect.property("value", year);

    let svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height + 20}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .style("width", "100%")
        .style("height", "auto");

    svg.selectAll("rect")
        .data(dates)
        .enter().append("rect")
        .attr("x", d => d3.timeFormat("%U")(d) * cellSize + 35)
        .attr("y", d => d.getDay() * cellSize + 20)
        .attr("width", cellSize - 2)
        .attr("height", cellSize - 2)
        .attr("fill", "#ebedf0")
        .on("mouseover", function (event, d) {
            let dateKey = parseDate(d);
            let solvedProblems = submissionCache[year]?.[dateKey]?.problems || [];
            if (solvedProblems.length > 0) {
                let tooltipHTML = `<strong>${dateKey}</strong><br>`;
                solvedProblems.forEach(prob => {
                    tooltipHTML += `<a href="${prob.link}" target="_blank" style="color: lightblue;">${prob.name} (${prob.rating})</a><br>`;
                });

                tooltip.html(tooltipHTML)
                    .style("left", (event.pageX + 4) + "px")
                    .style("top", (event.pageY + 4) + "px")
                    .style("visibility", "visible");
            }
        })
        
        svg.on("mouseleave", function () {
            tooltip.style("visibility", "hidden");
        });

         // Month labels
        let months = d3.timeMonths(startDate, endDate);
        svg.selectAll(".month-label")
            .data(months)
            .enter().append("text")
            .attr("x", d => d3.timeFormat("%U")(d) * cellSize + 45)
            .attr("y", 12)
            .style("font-size", "12px")
            .text(d3.timeFormat("%b"));

        let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        let filteredDays = [1, 3, 5];
        svg.selectAll(".day-label")
        .data(filteredDays)
        .enter()
        .append("text")
        .attr("x", 30)  // Adjust alignment
        .attr("y", d => d * cellSize + 30)  // Ensure correct positioning
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .text(d => days[d]);
    
    return { svg, dates, parseDate };
}

function getRatingColor(problems) {
    if (!problems.length) return "#ebedf0";

    let maxRating = Math.max(...problems.map(p => p.rating));

    // Find the color range of maxRating
    let colorEntry = ratingColors.find(c => maxRating >= c.min);
    let baseColor = colorEntry.color;

    let opacityFactor = 0.9;
    return baseColor.replace(/0\.9\)/, `${opacityFactor})`);
}

async function renderHeatmap(year) {
    let { svg, dates, parseDate } = createHeatmap(year);
    let submissionData = await fetchSubmissionData();
    let solvedDates = submissionData[year] || {};

    svg.selectAll("rect")
        .transition().duration(200) // Updated duration
        .attr("fill", d => {
            let dateKey = parseDate(d);
            return solvedDates[dateKey] ? getRatingColor(solvedDates[dateKey].problems) : "#ebedf0";
        });
}

fetchSubmissionData().then(() => {
    renderHeatmap(new Date().getFullYear());
});
