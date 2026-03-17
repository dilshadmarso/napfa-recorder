import React, { useEffect, useState } from "react";

const API_BASE = "https://script.google.com/macros/s/AKfycbyueZpK7QN12YHEysw6YOSZ8wa2Mi_VVfeJcjkH3g1rCzO8WNPbRz68knNzYK5-lSRb/exec";

const stations = [
{ id: "situp", label: "Sit Up", better: "higher" },
{ id: "broadjump", label: "Broad Jump", better: "higher" },
{ id: "sitreach", label: "Sit & Reach", better: "higher" },
{ id: "ipu", label: "IPU / Pull-up", better: "higher" },
{ id: "shuttle", label: "Shuttle Run", better: "lower" },
];

function getBest(a1, a2, better) {
const v1 = parseFloat(a1);
const v2 = parseFloat(a2);

if (isNaN(v1) && isNaN(v2)) return "";
if (!isNaN(v1) && isNaN(v2)) return v1;
if (isNaN(v1) && !isNaN(v2)) return v2;

if (better === "lower") return v1 < v2 ? v1 : v2;
return v1 > v2 ? v1 : v2;
}

export default function App() {
const [page, setPage] = useState("login");

const [teacher, setTeacher] = useState("");
const [station, setStation] = useState("broadjump");

const [classes, setClasses] = useState([]);
const [selectedClass, setSelectedClass] = useState("");

const [groups, setGroups] = useState([]);
const [selectedGroup, setSelectedGroup] = useState("");

const [students, setStudents] = useState([]);
const [scores, setScores] = useState({});

// load classes
useEffect(() => {
if (page !== "groups") return;

```
fetch(`${API_BASE}?action=getClasses`)
  .then(r => r.json())
  .then(data => {
    setClasses(data.classes || []);
    if (data.classes?.length) setSelectedClass(data.classes[0]);
  });
```

}, [page]);

// load groups
useEffect(() => {
if (!selectedClass) return;

```
fetch(`${API_BASE}?action=getGroups&className=${selectedClass}`)
  .then(r => r.json())
  .then(data => setGroups(data.groups || []));
```

}, [selectedClass]);

const loadGroup = (group) => {
fetch(`${API_BASE}?action=getGroupStudents&className=${selectedClass}&group=${group}`)
.then(r => r.json())
.then(data => {
setStudents(data.students || []);
setSelectedGroup(group);
setPage("entry");
});
};

const updateScore = (id, key, value) => {
setScores(prev => ({
...prev,
[id]: {
...(prev[id] || { a1: "", a2: "" }),
[key]: value
}
}));
};

const save = async () => {
for (let s of students) {
const rec = scores[s.id];
if (!rec) continue;

```
  await fetch(API_BASE, {
    method: "POST",
    body: JSON.stringify({
      action: "saveAttempt",
      teacher,
      station,
      className: selectedClass,
      group: selectedGroup,
      studentId: s.id,
      attempt1: rec.a1,
      attempt2: rec.a2
    })
  });
}

await fetch(API_BASE, {
  method: "POST",
  body: JSON.stringify({
    action: "submitGroup",
    teacher,
    station,
    className: selectedClass,
    group: selectedGroup
  })
});

alert("Submitted!");
setPage("groups");
```

};

// UI

if (page === "login") {
return (
<div style={{ padding: 30 }}> <h2>Teacher</h2>
<input value={teacher} onChange={e => setTeacher(e.target.value)} />

```
    <h2>Station</h2>
    {stations.map(s => (
      <button key={s.id} onClick={() => setStation(s.id)}>
        {s.label}
      </button>
    ))}

    <br /><br />
    <button onClick={() => setPage("groups")}>Start</button>
  </div>
);
```

}

if (page === "groups") {
return (
<div style={{ padding: 30 }}> <h2>Select Group</h2>

```
    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
      {classes.map(c => <option key={c}>{c}</option>)}
    </select>

    <div>
      {groups.map(g => (
        <button key={g} onClick={() => loadGroup(g)}>
          {g}
        </button>
      ))}
    </div>

    <br />
    <button onClick={() => setPage("login")}>Back</button>
  </div>
);
```

}

return (
<div style={{ padding: 30 }}> <h2>{selectedGroup}</h2>

```
  {students.map(s => {
    const rec = scores[s.id] || {};
    const best = getBest(rec.a1, rec.a2, stations.find(x => x.id === station).better);

    return (
      <div key={s.id} style={{ border: "1px solid grey", margin: 10, padding: 10 }}>
        <b>{s.name}</b> ({s.gender})

        <div>
          <input
            placeholder="Attempt 1"
            value={rec.a1 || ""}
            onChange={e => updateScore(s.id, "a1", e.target.value)}
          />
          <input
            placeholder="Attempt 2"
            value={rec.a2 || ""}
            onChange={e => updateScore(s.id, "a2", e.target.value)}
          />
        </div>

        <div>Best: {best}</div>
      </div>
    );
  })}

  <button onClick={() => setPage("groups")}>Back</button>
  <button onClick={save}>Submit</button>
</div>
```

);
}
