document.addEventListener("DOMContentLoaded", login);
const signin = "https://01.kood.tech/api/auth/signin";
const graphql = "https://01.kood.tech/api/graphql-engine/v1/graphql";
function setup() {
  document.getElementById("loginbtn").addEventListener("click", login);
}

function login(e) {
  e.preventDefault();
  const u = "antisults";
  const p = "sultsike123";
  const base64 = btoa(`${u}:${p}`);

  fetch(signin, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      const token = data;
      localStorage.setItem("jwtToken", token);
      //JWT token got and stored
      goToProfile();
    })
    .catch((error) => console.log("Error: ", error));
}

async function goToProfile() {
  let userInfo = await fetchUserInfo();
  let xpRatio = await fetchXp();
  userInfo = userInfo.user[0];
  const app = document.getElementById("app");
  app.innerHTML = `
    <div id="userProfile">
      <div id="userId">
          <h1>ID:</h1>
          <p></p>
        </div>
        <div id="userName">
          <h1>Username:</h1>
          <p></p>
        </div>
        <div id="xp">
          <h1>XP:</h1>
          <p></p>
        </div>
        <div id="audit-ratio">
          <h1>Audit Ratio:</h1>
          <p></p>
        </div>
    </div>
    <svg id="chart-container"></svg>
    <svg id="pie"></svg>
  `;
  document.querySelector("#userId>p").innerText = userInfo.id;
  document.querySelector("#userName>p").innerText = userInfo.login;
  document.querySelector("#xp>p").innerText = xpRatio.xp;
  document.querySelector("#audit-ratio>p").innerText = xpRatio.ratio;
  svgXpByProject();
  testfunc();
}

async function fetchUserInfo() {
  const token = localStorage.getItem("jwtToken");
  let info;
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      {
        user{
          id,
          login
        }
      }
      `,
    }),
  };
  await fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      info = data.data;
    })
    .catch((error) => {
      console.error("Error fetching user information", error);
    });
  return info;
}

async function fetchXp() {
  const token = localStorage.getItem("jwtToken");
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      {
        xpTrans: transaction(where: { 
          type: { _eq: "xp" }, 
          path: { _regex: "^(?!.*piscine-js).*johvi/div-01.*" }  
        }) {
          amount,
          user{
            auditRatio
          }
        }
      }
      `,
    }),
  };
  let xp = 0;
  let auditRatio;
  await fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      data.data.xpTrans.forEach((s) => (xp += s.amount));
      if (!auditRatio) auditRatio = data.data.xpTrans[0].user.auditRatio;
    })
    .catch((error) => {
      console.error("Error fetching something", error);
    });
  return { xp: xp, ratio: auditRatio };
}

async function svgXpByProject() {
  const token = localStorage.getItem("jwtToken");
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      {
        xpTrans: transaction(where: { 
          type: { _eq: "xp" }, 
          path: { _regex: "^(?!.*piscine-js).*johvi/div-01.*" }  
        }) {
          amount,
          createdAt,
    object{
      name
    }
        }
      }
      `,
    }),
  };
  fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      const sortedData = data.data.xpTrans.sort((a, b) => {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      createSvg(sortedData);
    })
    .catch((error) => {
      console.error("Error fetching something", error);
    });
}

function createSvg(data) {
  const largestScore = data.reduce((maxAmount, entry) => {
    return Math.max(maxAmount, entry.amount);
  }, 0);

  const svgW = 1600;
  const svgH = 300;
  const margin = { top: 50, bottom: 70, left: 50, right: 50 };
  const barPadding = 10;

  const svg = d3
    .select("#chart-container")
    .attr("width", svgW - margin.left - margin.right)
    .attr("height", svgH - margin.top - margin.bottom)
    .attr("viewBox", [0, 0, svgW, svgH]);

  const x = d3
    .scaleBand()
    .domain(data.map((d, i) => i))
    .rangeRound([margin.left, svgW - margin.right])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([0, largestScore])
    .range([svgH - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("fill", "grey")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", (d, i) => x(i))
    .attr("y", (d) => y(d.amount))
    .attr("height", (d) => svgH - margin.bottom - y(d.amount))
    .attr("width", x.bandwidth())
    .attr("class", "svg-rect");

  function xAxis(g) {
    g.attr("transform", `translate(0, ${svgH - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat((i) => data[i].object.name))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-25)")
      .attr("font-size", "15px");
  }
  function yAxis(g) {
    g.attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(null, data.format))
      .attr("font-size", "20px");
  }
  svg.append("g").call(yAxis);
  svg.append("g").call(xAxis);
  svg.node();
}

function testfunc() {
  const token = localStorage.getItem("jwtToken");
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      {
        xpTrans: transaction(where: { 
           
          path: { _regex: "^(?!.*piscine-js).*johvi/div-01.*" }  
        }) {
    			type,
        }
}
      `,
    }),
  };
  fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      const cData = data.data.xpTrans;
      let received = 0;
      let done = 0;
      console.log("temp", cData);
      cData.forEach((obj) => {
        if (obj.type == "up") {
          done++;
        } else if (obj.type == "down") {
          received++;
        }
        createPie([
          { type: "done", amount: done },
          { type: "recived", amount: received },
        ]);
      });
      console.log(received, done);
    })
    .catch((error) => {
      console.error("Error fetching something", error);
    });
}

function createPie(obj) {
  console.log(obj);
  const svgW = 400,
    svgH = 400,
    radius = Math.min(svgW, svgH) / 2;
  let svg = d3.select("#pie").attr("width", svgW).attr("height", svgH);
  let g = svg
    .append("g")
    .attr("transform", "translate(" + radius + "," + radius + ")");
  let color = d3.scaleOrdinal(d3.schemeCategory10);
  var pie = d3.pie().value(function (d) {
    return d.amount;
  });
  let path = d3.arc().outerRadius(radius).innerRadius(0);
  let arc = g.selectAll("arc").data(pie(obj)).enter().append("g");
  arc
    .append("path")
    .attr("d", path)
    .attr("fill", function (d) {
      return color(d.data.amount);
    });
  var label = d3.arc().outerRadius(radius).innerRadius(0);
  arc
    .append("text")
    .attr("transform", function (d) {
      return "translate(" + label.centroid(d) + ")";
    })
    .attr("dy", "0.35em")
    .text(function (d) {
      return d.data.amount;
    });

  const legend = svg
    .selectAll(".legend")
    .data(obj.map((d) => d.type)) // Use obj data for legend
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", function (d, i) {
      return "translate(" + (svgW - 100) + "," + (i * 20 + 20) + ")";
    });

  legend
    .append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function (d) {
      return color(obj.find((item) => item.type === d).amount);
    });

  legend
    .append("text")
    .attr("x", 24)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function (d) {
      return d;
    });
}

function getUserIdFromToken(token) {
  let parts = token.split(".");
  return JSON.parse(atob(parts[1])).sub;
}
