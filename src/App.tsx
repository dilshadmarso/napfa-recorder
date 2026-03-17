import React, { useEffect, useState } from "react";

const API_BASE =
  "https://script.google.com/macros/s/AKfycbyueZpK7QN12YHEysw6YOSZ8wa2Mi_VVfeJcjkH3g1rCzO8WNPbRz68knNzYK5-lSRb/exec";

const stations = [
  { id: "situp", label: "Sit Up", better: "higher" },
  { id: "broadjump", label: "Broad Jump", better: "higher" },
  { id: "sitreach", label: "Sit & Reach", better: "higher" },
  { id: "ipu", label: "IPU / Pull-up", better: "higher" },
  { id: "shuttle", label: "Shuttle Run", better: "lower" },
];

type Station = {
  id: string;
  label: string;
  better: "higher" | "lower";
};

type Student = {
  no: number;
  name: string;
  id: string;
  className: string;
  gender: string;
  dob: string;
  group: string;
};

type ScoreRecord = {
  a1: string;
  a2: string;
};

function getBest(a1: string, a2: string, better: "higher" | "lower") {
  const v1 = parseFloat(a1);
  const v2 = parseFloat(a2);

  if (Number.isNaN(v1) && Number.isNaN(v2)) return "";
  if (!Number.isNaN(v1) && Number.isNaN(v2)) return String(v1);
  if (Number.isNaN(v1) && !Number.isNaN(v2)) return String(v2);

  if (better === "lower") return String(v1 < v2 ? v1 : v2);
  return String(v1 > v2 ? v1 : v2);
}

export default function App() {
  const [page, setPage] = useState<"login" | "groups" | "entry">("login");

  const [teacher, setTeacher] = useState("");
  const [station, setStation] = useState("broadjump");

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreRecord>>({});

  useEffect(() => {
    if (page !== "groups") return;

    fetch(`${API_BASE}?action=getClasses`)
      .then((r) => r.json())
      .then((data) => {
        setClasses(data.classes || []);
        if (data.classes?.length) setSelectedClass(data.classes[0]);
      })
      .catch((err) => {
        console.error("Failed to load classes:", err);
      });
  }, [page]);

  useEffect(() => {
    if (!selectedClass) return;

    fetch(`${API_BASE}?action=getGroups&className=${encodeURIComponent(selectedClass)}`)
      .then((r) => r.json())
      .then((data) => setGroups(data.groups || []))
      .catch((err) => {
        console.error("Failed to load groups:", err);
      });
  }, [selectedClass]);

  const loadGroup = (group: string) => {
    fetch(
      `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(
        selectedClass
      )}&group=${encodeURIComponent(group)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students || []);
        setSelectedGroup(group);
        setPage("entry");
      })
      .catch((err) => {
        console.error("Failed to load group students:", err);
      });
  };

  const updateScore = (id: string, key: "a1" | "a2", value: string) => {
    setScores((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { a1: "", a2: "" }),
        [key]: value,
      },
    }));
  };

  const save = async () => {
    try {
      for (const s of students) {
        const rec = scores[s.id];
        if (!rec) continue;

        await fetch(API_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "saveAttempt",
            teacher,
            station: stations.find((x) => x.id === station)?.label,
            className: selectedClass,
            group: selectedGroup,
            studentId: s.id,
            attempt1: rec.a1,
            attempt2: rec.a2,
          }),
        });
      }

      await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "submitGroup",
          teacher,
          station: stations.find((x) => x.id === station)?.label,
          className: selectedClass,
          group: selectedGroup,
        }),
      });

      alert("Submitted");
      setPage("groups");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed");
    }
  };

  const currentStation: Station =
    stations.find((x) => x.id === station) || stations[1];

  if (page === "login") {
    return (
      <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
        <h2>Teacher</h2>
        <input
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
          style={{ padding: 8, width: 250 }}
        />

        <h2 style={{ marginTop: 24 }}>Station</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => setStation(s.id)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: station === s.id ? "#111" : "#fff",
                color: station === s.id ? "#fff" : "#111",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setPage("groups")}
            style={{ padding: "10px 16px", cursor: "pointer" }}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  if (page === "groups") {
    return (
      <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
        <h2>Select Group</h2>

        <div style={{ marginBottom: 16 }}>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ padding: 10, minWidth: 200 }}
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => loadGroup(g)}
              style={{
                padding: "12px 16px",
                border: "1px solid #ccc",
                borderRadius: 10,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setPage("login")}
            style={{ padding: "10px 16px", cursor: "pointer" }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <h2>{selectedGroup}</h2>

      {students.map((s) => {
        const rec = scores[s.id] || { a1: "", a2: "" };
        const best = getBest(rec.a1, rec.a2, currentStation.better);

        return (
          <div
            key={s.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: 10,
              marginBottom: 12,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>{s.name}</div>
            <div style={{ color: "#666", marginBottom: 8 }}>
              {s.gender} • {s.group}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Attempt 1"
                value={rec.a1}
                onChange={(e) => updateScore(s.id, "a1", e.target.value)}
                style={{ padding: 8, minWidth: 120 }}
              />
              <input
                placeholder="Attempt 2"
                value={rec.a2}
                onChange={(e) => updateScore(s.id, "a2", e.target.value)}
                style={{ padding: 8, minWidth: 120 }}
              />
            </div>

            <div style={{ marginTop: 8 }}>Best: {best}</div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={() => setPage("groups")}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Back
        </button>
        <button
          onClick={save}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
