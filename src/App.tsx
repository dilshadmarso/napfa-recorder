import React, { useEffect, useMemo, useRef, useState } from "react";

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
  status: "not-started" | "in-progress";
};

type RowSaveState = "typing" | "saving" | "saved" | "error" | "";

function formatValueForDisplay(value: number, stationId: string) {
  if (stationId === "shuttle") {
    return value.toFixed(1);
  }
  return String(value);
}

function getBest(
  a1: string,
  a2: string,
  better: "higher" | "lower",
  stationId: string
) {
  const v1 = parseFloat(a1);
  const v2 = parseFloat(a2);

  if (Number.isNaN(v1) && Number.isNaN(v2)) return "";
  if (!Number.isNaN(v1) && Number.isNaN(v2)) return formatValueForDisplay(v1, stationId);
  if (Number.isNaN(v1) && !Number.isNaN(v2)) return formatValueForDisplay(v2, stationId);

  if (better === "lower") {
    return formatValueForDisplay(v1 < v2 ? v1 : v2, stationId);
  }

  return formatValueForDisplay(v1 > v2 ? v1 : v2, stationId);
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

function getValidationConfig(stationId: string) {
  switch (stationId) {
    case "situp":
      return { maxLength: 2, placeholder: "0-99", mode: "integer" as const };
    case "broadjump":
      return { maxLength: 3, placeholder: "0-999", mode: "integer" as const };
    case "sitreach":
      return { maxLength: 2, placeholder: "0-99", mode: "integer" as const };
    case "ipu":
      return { maxLength: 2, placeholder: "0-99", mode: "integer" as const };
    case "shuttle":
      return { maxLength: 4, placeholder: "0.0", mode: "decimal1" as const };
    default:
      return { maxLength: 3, placeholder: "", mode: "integer" as const };
  }
}

function sanitiseInput(value: string, stationId: string) {
  const raw = value.trim();

  if (stationId === "shuttle") {
    let cleaned = raw.replace(/[^0-9.]/g, "");

    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }

    const parts = cleaned.split(".");
    const whole = (parts[0] || "").slice(0, 3);
    const decimal = (parts[1] || "").slice(0, 1);

    cleaned = decimal !== "" ? `${whole}.${decimal}` : whole;

    if (cleaned.length > 4) {
      cleaned = cleaned.slice(0, 4);
    }

    return cleaned;
  }

  const digitsOnly = raw.replace(/\D/g, "");

  if (stationId === "broadjump") {
    return digitsOnly.slice(0, 3);
  }

  return digitsOnly.slice(0, 2);
}

function isValidValueForStation(value: string, stationId: string) {
  if (value === "") return true;

  if (stationId === "shuttle") {
    return /^\d{2,3}(\.\d)?$/.test(value);
  }

  if (stationId === "broadjump") {
    return /^\d{1,3}$/.test(value);
  }

  return /^\d{1,2}$/.test(value);
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from server: ${text.slice(0, 120)}`);
  }

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

  const [scoresByGroup, setScoresByGroup] = useState<Record<string, Record<string, ScoreRecord>>>(
    {}
  );
  const [rowSaveStateByGroup, setRowSaveStateByGroup] = useState<
    Record<string, Record<string, RowSaveState>>
  >({});
  const saveTimersRef = useRef<Record<string, number>>({});

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [clearingGroup, setClearingGroup] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentStation: Station = stations.find((x) => x.id === station) || stations[1];
  const currentValidation = getValidationConfig(currentStation.id);

  const currentScores = scoresByGroup[selectedGroup] || {};
  const currentRowSaveState = rowSaveStateByGroup[selectedGroup] || {};

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

  const hasPendingSaves = useMemo(() => {
    return Object.values(currentRowSaveState).some(
      (state) => state === "typing" || state === "saving"
    );
  }, [currentRowSaveState]);

  useEffect(() => {
    if (page !== "groups") return;

    const loadClasses = async () => {
      try {
        setLoadingClasses(true);
        setError("");

        const data = await fetchJson(`${API_BASE}?action=getClasses`);
        const nextClasses = Array.isArray(data.classes) ? data.classes : [];

        setClasses(nextClasses);

        if (!selectedClass && nextClasses.length > 0) {
          setSelectedClass(nextClasses[0]);
        }
      } catch (err) {
        console.error("Failed to load classes:", err);
        setError(err instanceof Error ? err.message : "Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };

    void loadClasses();
  }, [page, selectedClass]);

  useEffect(() => {
    if (!selectedClass || page !== "groups") return;

    const loadGroupsAndStatuses = async () => {
      try {
        setLoadingGroups(true);
        setError("");

        const groupsData = await fetchJson(
          `${API_BASE}?action=getGroups&className=${encodeURIComponent(selectedClass)}`
        );

        const nextGroups = Array.isArray(groupsData.groups) ? groupsData.groups : [];
        setGroups(nextGroups);

        try {
          const statusesData = await fetchJson(
            `${API_BASE}?action=getGroupStatuses&className=${encodeURIComponent(
              selectedClass
            )}&stationId=${encodeURIComponent(currentStation.id)}`
          );

          const map: Record<string, GroupStatus["status"]> = {};
          const statuses = Array.isArray(statusesData.statuses) ? statusesData.statuses : [];

          statuses.forEach((item: GroupStatus) => {
            if (item?.group) {
              map[item.group] = item.status;
            }
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
              const nextStudents = Array.isArray(groupData.students) ? groupData.students : [];
              setStudentsByGroup((prev) => {
                if (prev[group]) return prev;
                return { ...prev, [group]: nextStudents };
              });
            })
            .catch((preloadErr) => {
              console.error(`Failed to preload ${group}:`, preloadErr);
            });
        });
      } catch (err) {
        console.error("Failed to load groups:", err);
        setError(err instanceof Error ? err.message : "Failed to load groups");
      } finally {
        setLoadingGroups(false);
      }
    };

    void loadGroupsAndStatuses();
  }, [selectedClass, currentStation.id, page, studentsByGroup]);

  useEffect(() => {
    if (!selectedGroup) return;

    if (studentsByGroup[selectedGroup]) {
      setStudents(studentsByGroup[selectedGroup]);
      setLoadingStudents(false);
    }
  }, [selectedGroup, studentsByGroup]);

  const focusInput = (studentIndex: number, key: "a1" | "a2") => {
    const element = document.getElementById(
      `input-${studentIndex}-${key}`
    ) as HTMLInputElement | null;
    element?.focus();
    element?.select();
  };

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
          teacher: teacher.trim(),
          stationId: currentStation.id,
          stationLabel: currentStation.label,
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
        [groupKey]: "in-progress",
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

  setError(err instanceof Error ? err.message : "Save failed");
}
  };

  const handleAttemptChange = (studentId: string, key: "a1" | "a2", value: string) => {
    const groupKey = selectedGroup;
    const cleaned = sanitiseInput(value, currentStation.id);

    const nextRecord = {
      ...((scoresByGroup[groupKey] || {})[studentId] || { a1: "", a2: "" }),
      [key]: cleaned,
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

    setError("");

    const timerKey = `${groupKey}::${studentId}`;

    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }

    const timer = window.setTimeout(() => {
      void saveAttemptNow(groupKey, studentId, nextRecord);
    }, 800);

    saveTimersRef.current[timerKey] = timer;
  };

  const loadGroupScores = async (group: string) => {
    const data = await fetchJson(
      `${API_BASE}?action=getGroupScores&className=${encodeURIComponent(
        selectedClass
      )}&group=${encodeURIComponent(group)}&stationId=${encodeURIComponent(currentStation.id)}`
    );

    const scoreRows = Array.isArray(data.scores) ? data.scores : [];
    const mappedScores: Record<string, ScoreRecord> = {};

    scoreRows.forEach((row: any) => {
      if (row?.studentId) {
        mappedScores[row.studentId] = {
          a1: row.attempt1 ? String(row.attempt1) : "",
          a2: row.attempt2 ? String(row.attempt2) : "",
        };
      }
    });

    setScoresByGroup((prev) => ({
      ...prev,
      [group]: mappedScores,
    }));

    const saveStateMap: Record<string, RowSaveState> = {};
    Object.keys(mappedScores).forEach((studentId) => {
      const r = mappedScores[studentId];
      if (r.a1 !== "" || r.a2 !== "") {
        saveStateMap[studentId] = "saved";
      }
    });

    setRowSaveStateByGroup((prev) => ({
      ...prev,
      [group]: saveStateMap,
    }));

    if (Object.keys(mappedScores).length > 0) {
      setGroupStatuses((prev) => ({
        ...prev,
        [group]: "in-progress",
      }));
    }
  };

  const handleLoadGroup = async (group: string) => {
    setSelectedGroup(group);
    setPage("entry");
    setLoadingStudents(true);
    setError("");
    setMessage("");

    try {
      let fetchedStudents = studentsByGroup[group];

      if (!fetchedStudents) {
        const data = await fetchJson(
          `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(
            selectedClass
          )}&group=${encodeURIComponent(group)}`
        );

        fetchedStudents = Array.isArray(data.students) ? data.students : [];

        setStudentsByGroup((prev) => ({
          ...prev,
          [group]: fetchedStudents!,
        }));
      }

      setStudents(fetchedStudents || []);
      await loadGroupScores(group);
    } catch (err) {
      console.error("Failed to load group:", err);
      setError(err instanceof Error ? err.message : "Unable to load group");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleEntryBack = () => {
    if (hasPendingSaves) {
      const confirmed = window.confirm("Some scores are still saving. Go back anyway?");
      if (!confirmed) return;
    }

    setMessage("");
    setError("");
    setPage("groups");
  };

  const handleClearGroup = async () => {
    if (!selectedGroup) return;

    const confirmedPhrase = window.prompt(
      `Type CLEAR to erase all saved values for ${selectedGroup}.`
    );

    if (confirmedPhrase !== "CLEAR") return;

    try {
      setClearingGroup(true);
      setError("");
      setMessage("");

      Object.values(saveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      saveTimersRef.current = {};

      await fetchJson(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "clearGroupScores",
          teacher: teacher.trim(),
          stationId: currentStation.id,
          stationLabel: currentStation.label,
          className: selectedClass,
          group: selectedGroup,
        }),
      });

      const clearedScores: Record<string, ScoreRecord> = {};
      const clearedRowStates: Record<string, RowSaveState> = {};

      students.forEach((student) => {
        clearedScores[student.id] = { a1: "", a2: "" };
        clearedRowStates[student.id] = "";
      });

      setScoresByGroup((prev) => ({
        ...prev,
        [selectedGroup]: clearedScores,
      }));

      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [selectedGroup]: clearedRowStates,
      }));

      setGroupStatuses((prev) => ({
        ...prev,
        [selectedGroup]: "not-started",
      }));

      setMessage(`${selectedGroup} cleared successfully`);
    } catch (err) {
      console.error("Clear failed:", err);
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearingGroup(false);
    }
  };

  if (page === "login") {
    return (
      <div
        style={{
          padding: 30,
          fontFamily: "Arial, sans-serif",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <h1 style={{ marginBottom: 6 }}>NAPFA Station Recorder</h1>
        <div style={{ color: "#666", marginBottom: 24 }}>Teacher session setup</div>

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

        <h2>Teacher</h2>
        <input
          value={teacher}
          onChange={(e) => {
            setTeacher(e.target.value);
            setError("");
            setMessage("");
          }}
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
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStation(s.id);
                setSelectedClass("");
                setSelectedGroup("");
                setMessage("");
                setError("");
              }}
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
            onClick={() => {
              if (!teacher.trim()) {
                setError("Please enter teacher name");
                return;
              }
              setError("");
              setMessage("");
              setPage("groups");
            }}
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
      <div
        style={{
          padding: 30,
          fontFamily: "Arial, sans-serif",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ marginBottom: 6 }}>Select Group</h1>
            <div style={{ color: "#666" }}>
              Teacher: {teacher || "—"} • Station: {currentStation.label}
            </div>
          </div>
          <button
            onClick={() => {
              setMessage("");
              setError("");
              setPage("login");
            }}
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
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedGroup("");
                setMessage("");
                setError("");
              }}
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
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {groups.map((g) => {
              const style = statusStyles(groupStatuses[g] || "not-started");

              return (
                <button
                  key={g}
                  onClick={() => void handleLoadGroup(g)}
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
    <div
      style={{
        padding: 30,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1000,
        margin: "0 auto",
        paddingBottom: 100,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Score Entry</h1>
          <div style={{ color: "#666" }}>
            Teacher: {teacher || "—"} • Station: {currentStation.label} • Class: {selectedClass} •
            Group: {selectedGroup}
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
          {loadingStudents
            ? "Opening group..."
            : `${completionCount} / ${students.length} entered`}
        </div>
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

      {students.map((s, index) => {
        const rec = currentScores[s.id] || { a1: "", a2: "" };
        const best = getBest(rec.a1, rec.a2, currentStation.better, currentStation.id);
        const bestAttempt = getBestAttempt(rec.a1, rec.a2, currentStation.better);
        const saveState = currentRowSaveState[s.id] || "";

        const a1Valid = isValidValueForStation(rec.a1, currentStation.id);
        const a2Valid = isValidValueForStation(rec.a2, currentStation.id);

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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {s.no}. {s.name}
                </div>
                <div style={{ color: "#666", marginBottom: 12 }}>
                  {s.gender} • {s.group}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color:
                    saveState === "error"
                      ? "#b91c1c"
                      : saveState === "saved"
                      ? "#166534"
                      : "#666",
                  fontWeight:
                    saveState === "saved" || saveState === "error" ? 700 : 500,
                }}
              >
                {saveState === "saving" && "Saving..."}
                {saveState === "saved" && "Saved"}
                {saveState === "typing" && "Typing..."}
                {saveState === "error" && "Save failed"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Attempt 1</div>
                <input
                  placeholder={currentValidation.placeholder}
                  value={rec.a1}
                  inputMode={station === "shuttle" ? "decimal" : "numeric"}
                  maxLength={currentValidation.maxLength}
                  enterKeyHint="next"
                  id={`input-${index}-a1`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      focusInput(index, "a2");
                    }
                  }}
                  onChange={(e) => handleAttemptChange(s.id, "a1", e.target.value)}
                  style={{
                    padding: 14,
                    width: "100%",
                    borderRadius: 10,
                    border: !a1Valid
                      ? "2px solid #dc2626"
                      : bestAttempt === 1
                      ? "2px solid #16a34a"
                      : "1px solid #ccc",
                    background: bestAttempt === 1 ? "#f0fdf4" : "#fff",
                    fontSize: 24,
                    minHeight: 64,
                  }}
                />
                {!a1Valid && (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>
                    Invalid value
                  </div>
                )}
                {bestAttempt === 1 && a1Valid && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Best
                  </div>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Attempt 2</div>
                <input
                  placeholder={currentValidation.placeholder}
                  value={rec.a2}
                  inputMode={station === "shuttle" ? "decimal" : "numeric"}
                  maxLength={currentValidation.maxLength}
                  enterKeyHint={index < students.length - 1 ? "next" : "done"}
                  id={`input-${index}-a2`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (index < students.length - 1) {
                        focusInput(index + 1, "a1");
                      }
                    }
                  }}
                  onChange={(e) => handleAttemptChange(s.id, "a2", e.target.value)}
                  style={{
                    padding: 14,
                    width: "100%",
                    borderRadius: 10,
                    border: !a2Valid
                      ? "2px solid #dc2626"
                      : bestAttempt === 2
                      ? "2px solid #16a34a"
                      : "1px solid #ccc",
                    background: bestAttempt === 2 ? "#f0fdf4" : "#fff",
                    fontSize: 24,
                    minHeight: 64,
                  }}
                />
                {!a2Valid && (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>
                    Invalid value
                  </div>
                )}
                {bestAttempt === 2 && a2Valid && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
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
                boxShadow: "inset 0 0 0 1px #e2e8f0",
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
          onClick={handleEntryBack}
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
          onClick={() => void handleClearGroup()}
          disabled={!hasData || clearingGroup}
          style={{
            padding: "14px 18px",
            cursor: !hasData || clearingGroup ? "not-allowed" : "pointer",
            borderRadius: 12,
            border: "1px solid #dc2626",
            background: "#fff",
            color: "#dc2626",
            fontSize: 16,
            flex: 1,
            opacity: !hasData || clearingGroup ? 0.6 : 1,
          }}
        >
          {clearingGroup ? "Clearing..." : "Clear Group"}
        </button>
      </div>
    </div>
  );
}
