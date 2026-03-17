import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  "https://script.google.com/macros/s/AKfycbyueZpK7QN12YHEysw6YOSZ8wa2Mi_VVfeJcjkH3g1rCzO8WNPbRz68knNzYK5-lSRb/exec";

const stations = [
  { id: "situp", label: "Sit Up", better: "higher" as const, unit: "reps" },
  { id: "broadjump", label: "Broad Jump", better: "higher" as const, unit: "cm" },
  { id: "sitreach", label: "Sit & Reach", better: "higher" as const, unit: "cm" },
  { id: "ipu", label: "IPU / Pull-up", better: "higher" as const, unit: "reps" },
  { id: "shuttle", label: "Shuttle Run", better: "lower" as const, unit: "s" },
];

type Station = {
  id: string;
  label: string;
  better: "higher" | "lower";
  unit: string;
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

type GroupStatus = {
  group: string;
  status: "not-started" | "in-progress" | "submitted";
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

function getBestAttempt(a1: string, a2: string, better: "higher" | "lower") {
  const v1 = parseFloat(a1);
  const v2 = parseFloat(a2);

  if (Number.isNaN(v1) && Number.isNaN(v2)) return 0;
  if (!Number.isNaN(v1) && Number.isNaN(v2)) return 1;
  if (Number.isNaN(v1) && !Number.isNaN(v2)) return 2;

  if (better === "lower") {
    if (v1 < v2) return 1;
    if (v2 < v1) return 2;
    return 0;
  }

  if (v1 > v2) return 1;
  if (v2 > v1) return 2;
  return 0;
}

function statusStyles(status: GroupStatus["status"]) {
  if (status === "submitted") {
    return {
      border: "1px solid #86efac",
      background: "#f0fdf4",
      label: "Submitted",
      labelColor: "#166534",
    };
  }

  if (status === "in-progress") {
    return {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      label: "In Progress",
      labelColor: "#92400e",
    };
  }

  return {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    label: "Not Started",
    labelColor: "#475569",
  };
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export default function App() {
  const [page, setPage] = useState<"login" | "groups" | "entry">("login");

  const [teacher, setTeacher] = useState("");
  const [station, setStation] = useState("broadjump");

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [groups, setGroups] = useState<string[]>([]);
  const [groupStatuses, setGroupStatuses] = useState<Record<string, GroupStatus["status"]>>({});
  const [selectedGroup, setSelectedGroup] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<string, Student[]>>({});

  const [scoresByGroup, setScoresByGroup] = useState<Record<string, Record<string, ScoreRecord>>>({});
  const [rowSaveStateByGroup, setRowSaveStateByGroup] = useState<Record<string, Record<string, string>>>({});
  const [saveTimers, setSaveTimers] = useState<Record<string, number>>({});

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentStation: Station =
    stations.find((x) => x.id === station) || stations[1];

  const currentScores = scoresByGroup[selectedGroup] || {};
  const currentRowSaveState = rowSaveStateByGroup[selectedGroup] || {};

  useEffect(() => {
    if (page !== "groups") return;

    const loadClasses = async () => {
      try {
        setLoadingClasses(true);
        setError("");

        const data = await fetchJson(`${API_BASE}?action=getClasses`);
        const nextClasses = data.classes || [];

        setClasses(nextClasses);

        if (!selectedClass && nextClasses.length > 0) {
          setSelectedClass(nextClasses[0]);
        }
      } catch (err) {
        console.error("Failed to load classes:", err);
        setError("Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };

    void loadClasses();
  }, [page, selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;

    const loadGroupsAndStatuses = async () => {
      try {
        setLoadingGroups(true);
        setError("");

        const groupsData = await fetchJson(
          `${API_BASE}?action=getGroups&className=${encodeURIComponent(selectedClass)}`
        );

        const nextGroups = groupsData.groups || [];
        setGroups(nextGroups);

        try {
          const statusesData = await fetchJson(
            `${API_BASE}?action=getGroupStatuses&className=${encodeURIComponent(
              selectedClass
            )}&station=${encodeURIComponent(currentStation.label)}`
          );

          const map: Record<string, GroupStatus["status"]> = {};
          (statusesData.statuses || []).forEach((item: GroupStatus) => {
            map[item.group] = item.status;
          });
          setGroupStatuses(map);
        } catch (statusErr) {
          console.error("Failed to load group statuses:", statusErr);
        }

        nextGroups.forEach((group: string) => {
          if (studentsByGroup[group]) return;

          fetchJson(
            `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(
              selectedClass
            )}&group=${encodeURIComponent(group)}`
          )
            .then((groupData) => {
              setStudentsByGroup((prev) => {
                if (prev[group]) return prev;
                return { ...prev, [group]: groupData.students || [] };
              });
            })
            .catch((preloadErr) => {
              console.error(`Failed to preload ${group}:`, preloadErr);
            });
        });
      } catch (err) {
        console.error("Failed to load groups:", err);
        setError("Failed to load groups");
      } finally {
        setLoadingGroups(false);
      }
    };

    void loadGroupsAndStatuses();
  }, [selectedClass, currentStation.label]);

  useEffect(() => {
    if (!selectedGroup) return;

    if (studentsByGroup[selectedGroup]) {
      setStudents(studentsByGroup[selectedGroup]);
      setLoadingStudents(false);
    }
  }, [selectedGroup, studentsByGroup]);

  const completionCount = useMemo(() => {
    return students.filter((student) => {
      const record = currentScores[student.id] || { a1: "", a2: "" };
      return record.a1 !== "" || record.a2 !== "";
    }).length;
  }, [students, currentScores]);

  const hasData = useMemo(() => {
    return Object.values(currentScores).some(
      (record) => record.a1 !== "" || record.a2 !== ""
    );
  }, [currentScores]);

  const saveAttemptNow = async (groupKey: string, studentId: string, record: ScoreRecord) => {
    try {
      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: {
          ...(prev[groupKey] || {}),
          [studentId]: "saving",
        },
      }));

      await fetchJson(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "saveAttempt",
          teacher,
          station: currentStation.label,
          className: selectedClass,
          group: groupKey,
          studentId,
          attempt1: record.a1,
          attempt2: record.a2,
        }),
      });

      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: {
          ...(prev[groupKey] || {}),
          [studentId]: "saved",
        },
      }));

      setGroupStatuses((prev) => ({
        ...prev,
        [groupKey]: prev[groupKey] === "submitted" ? "submitted" : "in-progress",
      }));
    } catch (err) {
      console.error("Save failed:", err);

      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: {
          ...(prev[groupKey] || {}),
          [studentId]: "error",
        },
      }));

      setError("Save failed");
    }
  };

  const handleAttemptChange = (studentId: string, key: keyof ScoreRecord, value: string) => {
    const groupKey = selectedGroup;

    const nextRecord = {
      ...((scoresByGroup[groupKey] || {})[studentId] || { a1: "", a2: "" }),
      [key]: value,
    };

    setScoresByGroup((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [studentId]: nextRecord,
      },
    }));

    setRowSaveStateByGroup((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [studentId]: "typing",
      },
    }));

    const timerKey = `${groupKey}::${studentId}`;

    if (saveTimers[timerKey]) {
      window.clearTimeout(saveTimers[timerKey]);
    }

    const timer = window.setTimeout(() => {
      void saveAttemptNow(groupKey, studentId, nextRecord);
    }, 800);

    setSaveTimers((prev) => ({
      ...prev,
      [timerKey]: timer,
    }));
  };

  const handleLoadGroup = async (group: string) => {
    setSelectedGroup(group);
    setPage("entry");
    setLoadingStudents(true);
    setError("");
    setMessage("");

    if (studentsByGroup[group]) {
      setStudents(studentsByGroup[group]);
      setLoadingStudents(false);
      return;
    }

    try {
      const data = await fetchJson(
        `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(
          selectedClass
        )}&group=${encodeURIComponent(group)}`
      );

      const fetchedStudents = data.students || [];
      setStudentsByGroup((prev) => ({
        ...prev,
        [group]: fetchedStudents,
      }));
      setStudents(fetchedStudents);
    } catch (err) {
      console.error("Failed to load students:", err);
      setError("Unable to load students");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleBackToGroups = () => {
    setPage("groups");
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");

      for (const timer of Object.values(saveTimers)) {
        window.clearTimeout(timer);
      }
      setSaveTimers({});

      for (const student of students) {
        const record = (scoresByGroup[selectedGroup] || {})[student.id];
        if (record && (record.a1 !== "" || record.a2 !== "")) {
          await saveAttemptNow(selectedGroup, student.id, record);
        }
      }

      await fetchJson(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "submitGroup",
          teacher,
          station: currentStation.label,
          className: selectedClass,
          group: selectedGroup,
        }),
      });

      setGroupStatuses((prev) => ({
        ...prev,
        [selectedGroup]: "submitted",
      }));

      setMessage(`${selectedGroup} submitted successfully`);
      setSelectedGroup("");
      setStudents([]);
      setPage("groups");
    } catch (err) {
      console.error("Submit failed:", err);
      setError("Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (page === "login") {
    return (
      <div style={{ padding: 30, fontFamily: "Arial, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>NAPFA Station Recorder</h1>
        <div style={{ color: "#666", marginBottom: 24 }}>Teacher session setup</div>

        <h2>Teacher</h2>
        <input
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
          style={{
            padding: 12,
            width: "100%",
            maxWidth: 320,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />

        <h2 style={{ marginTop: 28 }}>Station</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => setStation(s.id)}
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid #ccc",
                background: station === s.id ? "#111" : "#fff",
                color: station === s.id ? "#fff" : "#111",
                cursor: "pointer",
                fontSize: 16,
                textAlign: "left",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 28 }}>
          <button
            onClick={() => setPage("groups")}
            style={{
              padding: "14px 20px",
              cursor: "pointer",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 16,
            }}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  if (page === "groups") {
    return (
      <div style={{ padding: 30, fontFamily: "Arial, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>Select Group</h1>
            <div style={{ color: "#666" }}>
              Teacher: {teacher || "—"} • Station: {currentStation.label}
            </div>
          </div>
          <button
            onClick={() => setPage("login")}
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "#fff",
              fontSize: 15,
            }}
          >
            Back
          </button>
        </div>

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: "#ecfdf5",
              border: "1px solid #86efac",
              color: "#166534",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>Class</div>
          {loadingClasses ? (
            <div>Loading classes...</div>
          ) : (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                padding: 12,
                minWidth: 220,
                borderRadius: 10,
                border: "1px solid #ccc",
                fontSize: 16,
              }}
            >
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingGroups ? (
          <div>Loading groups...</div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {groups.map((g) => {
              const style = statusStyles(groupStatuses[g] || "not-started");

              return (
                <button
                  key={g}
                  onClick={() => handleLoadGroup(g)}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    ...style,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{g}</div>
                  <div style={{ color: "#666", marginBottom: 10 }}>Tap to load this group</div>
                  <div style={{ fontWeight: 700, color: style.labelColor }}>{style.label}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial, sans-serif", maxWidth: 1000, margin: "0 auto", paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Score Entry</h1>
          <div style={{ color: "#666" }}>
            Teacher: {teacher || "—"} • Station: {currentStation.label} • Class: {selectedClass} • Group: {selectedGroup}
          </div>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            background: "#111",
            color: "#fff",
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          {loadingStudents ? "Opening group..." : `${completionCount} / ${students.length} entered`}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {loadingStudents && (
        <div
          style={{
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 12,
            background: "#fff",
            marginBottom: 16,
          }}
        >
          Loading students...
        </div>
      )}

      {students.map((s) => {
        const rec = currentScores[s.id] || { a1: "", a2: "" };
        const best = getBest(rec.a1, rec.a2, currentStation.better);
        const bestAttempt = getBestAttempt(rec.a1, rec.a2, currentStation.better);
        const saveState = currentRowSaveState[s.id] || "";

        return (
          <div
            key={s.id}
            id={`row-${s.id}`}
            style={{
              border: "1px solid #ccc",
              borderRadius: 14,
              marginBottom: 14,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{s.name}</div>
                <div style={{ color: "#666", marginBottom: 12 }}>
                  {s.gender} • {s.group}
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#666" }}>
                {saveState === "saving" && "Saving..."}
                {saveState === "saved" && "Saved"}
                {saveState === "typing" && "Typing..."}
                {saveState === "error" && "Save failed"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Attempt 1</div>
                <input
                  placeholder={currentStation.unit}
                  value={rec.a1}
                  inputMode={station === "shuttle" ? "decimal" : "numeric"}
                  onChange={(e) => updateScore(s.id, "a1", e.target.value)}
                  style={{
                    padding: 14,
                    width: "100%",
                    borderRadius: 10,
                    border: bestAttempt === 1 ? "2px solid #16a34a" : "1px solid #ccc",
                    background: bestAttempt === 1 ? "#f0fdf4" : "#fff",
                    fontSize: 20,
                  }}
                />
                {bestAttempt === 1 && (
                  <div style={{ marginTop: 6, color: "#166534", fontWeight: 700, fontSize: 14 }}>
                    Best
                  </div>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Attempt 2</div>
                <input
                  placeholder={currentStation.unit}
                  value={rec.a2}
                  inputMode={station === "shuttle" ? "decimal" : "numeric"}
                  onChange={(e) => updateScore(s.id, "a2", e.target.value)}
                  style={{
                    padding: 14,
                    width: "100%",
                    borderRadius: 10,
                    border: bestAttempt === 2 ? "2px solid #16a34a" : "1px solid #ccc",
                    background: bestAttempt === 2 ? "#f0fdf4" : "#fff",
                    fontSize: 20,
                  }}
                />
                {bestAttempt === 2 && (
                  <div style={{ marginTop: 6, color: "#166534", fontWeight: 700, fontSize: 14 }}>
                    Best
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#f8fafc",
                fontWeight: 700,
              }}
            >
              Best Score: {best ? `${best} ${currentStation.unit}` : "—"}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "#fff",
          paddingTop: 12,
          display: "flex",
          gap: 12,
        }}
      >
        <button
          onClick={handleBackToGroups}
          style={{
            padding: "14px 18px",
            cursor: "pointer",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "#fff",
            fontSize: 16,
            flex: 1,
          }}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasData || submitting}
          style={{
            padding: "14px 18px",
            cursor: !hasData || submitting ? "not-allowed" : "pointer",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontSize: 16,
            flex: 1,
            opacity: !hasData || submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting..." : "Save & Submit"}
        </button>
      </div>
    </div>
  );
}
