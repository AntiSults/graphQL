document.addEventListener("DOMContentLoaded", setup);
const signin = "https://01.kood.tech/api/auth/signin";
const graphql = "https://01.kood.tech/api/graphql-engine/v1/graphql";
function setup() {
  document.getElementById("loginbtn").addEventListener("click", login);
}

function login(e) {
  e.preventDefault();
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;
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
      if (data.error) {
        failedToSignIn(data.error);
        return;
      }
      const token = data;
      localStorage.setItem("jwtToken", token);
      goToProfile();
    })
    .catch((error) => console.log("Error: ", error));
}

function failedToSignIn(error) {
  const container = document.getElementById("container");
  const html = `
      <h1>Failed to log in!</h1>
      <p></p>
  `;
  const check = document.getElementById("login-error");
  if (!check) {
    const errorDiv = document.createElement("div");
    errorDiv.setAttribute("id", "login-error");
    errorDiv.innerHTML = html;
    errorDiv.addEventListener("click", function () {
      errorDiv.remove();
    });
    container.append(errorDiv);
    document.querySelector("#login-error>p").innerText = error;
  }
}

async function goToProfile() {
  let userInfo = await fetchUserInfo();
  let xpRatio = await fetchXp();
  userInfo = userInfo.user[0];
  const app = document.getElementById("app");
  app.innerHTML = `
    <button id="logout">Log out</button>
    <div id="userProfile">
      <div id="userId">
          <h1>ID:</h1>
          <p></p>
        </div>
        <div id="userName">
          <h1>Username:</h1>
          <p></p>
        </div>
        <div id="email">
          <h1>Email:</h1>
          <p></p>
        </div>
        <div id="tel">
          <h1>Phone number:</h1>
          <p></p>
        </div>
        <div id="xp">
          <h1>XP(bytes):</h1>
          <p></p>
        </div>
        <div id="audit-ratio">
          <h1>Audit Ratio:</h1>
          <p></p>
        </div>
    </div>
    <div id="charts">
      <div id="chart-container">
        <h1>Progress over projects</h1>
        <svg id="chart"></svg>
      </div>
      <div id="pie-container">
        <h1>Audits done vs received</h1>
        <svg id="pie"></svg>
      </div>
    </div>
  `;
  document.querySelector("#logout").addEventListener("click", logout);
  document.querySelector("#userId>p").innerText = userInfo.id;
  document.querySelector("#email>p").innerText = userInfo.email;
  document.querySelector("#tel>p").innerText = userInfo.tel;
  document.querySelector("#userName>p").innerText = userInfo.login;
  document.querySelector("#xp>p").innerText = xpRatio.xp;
  document.querySelector("#audit-ratio>p").innerText = xpRatio.ratio;
  svgXpByProject();
  getAuditGraph();
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
          login,
          tel: attrs(path: "tel")
          email: attrs(path: "email")
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
      data.data.xpTrans.forEach((s) => (xp += s.amount));
      if (!auditRatio)
        auditRatio = Number(data.data.xpTrans[0].user.auditRatio.toFixed(1));
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

  const svgW = 1000;
  const svgH = 800;
  const margin = { top: 80, bottom: 120, left: 0, right: 0 };
  const barPadding = 10;

  const svg = d3
    .select("#chart")
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

function getAuditGraph() {
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
    })
    .catch((error) => {
      console.error("Error fetching something", error);
    });
}

function createPie(obj) {
  const svgW = 500,
    svgH = 300,
    radius = Math.min(svgW, svgH) / 2;
  let svg = d3.select("#pie").attr("width", svgW).attr("height", svgH);
  let g = svg
    .append("g")
    .attr("transform", "translate(" + radius + "," + radius + ")");
  let color = d3.scaleOrdinal(d3.schemePastel2);
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

  const legends = svg
    .append("g")
    .attr("transform", "translate(350, 200)")
    .selectAll(".legends")
    .data(obj);
  var legend = legends
    .enter()
    .append("g")
    .classed("legends", true)
    .attr("transform", function (d, i) {
      return "translate(0, " + (i + 1) * 30 + ")";
    });
  legend
    .append("rect")
    .attr("width", 20)
    .attr("height", 20)
    .attr("fill", function (d) {
      return color(d.amount);
    });
  legend
    .append("text")
    .text(function (d) {
      return d.type;
    })
    .attr("fill", function (d) {
      return color(d.amount);
    })
    .attr("x", 30)
    .attr("y", 15);
}

function getUserIdFromToken(token) {
  let parts = token.split(".");
  return JSON.parse(atob(parts[1])).sub;
}

function logout() {
  localStorage.removeItem("jwtToken");
  document.querySelector("#app").innerHTML = `
    <div id="container">
        <div id="login">
          <h1>Log in to see your information</h1>
          <form action="#">
            <label for="username">Username or email</label>
            <input type="text" id="username" />
            <label for="password">Password</label>
            <input type="password" id="password" />
            <button id="loginbtn">Log in</button>
          </form>
        </div>
      </div>
  `;
  setup();
}
