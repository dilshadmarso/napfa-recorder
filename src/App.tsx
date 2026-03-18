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
  absent: boolean;
};

type GroupStatusValue = "not-started" | "in-progress" | "completed";
type RowSaveState = "typing" | "saving" | "saved" | "error" | "";

const ui = {
  page: {
    padding: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Arial, sans-serif',
    maxWidth: 1100,
    margin: "0 auto",
    paddingBottom: 120,
    background: "#f8fafc",
    minHeight: "100vh",
    boxSizing: "border-box" as const,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    color: "#0f172a",
  },
  sectionSub: {
    color: "#475569",
    fontSize: 15,
    marginTop: 6,
  },
  primaryButton: {
    padding: "16px 20px",
    cursor: "pointer",
    borderRadius: 16,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    fontSize: 17,
    fontWeight: 700,
    minHeight: 56,
  },
  secondaryButton: {
    padding: "16px 20px",
    cursor: "pointer",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 700,
    minHeight: 56,
  },
  dangerButton: {
    padding: "16px 20px",
    cursor: "pointer",
    borderRadius: 16,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    fontSize: 17,
    fontWeight: 700,
    minHeight: 56,
  },
  input: {
    padding: "16px 18px",
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 26,
    minHeight: 72,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  successBox: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 600,
  },
  errorBox: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#991b1b",
    fontWeight: 600,
  },
};

function formatValueForDisplay(value: number, stationId: string) {
  if (stationId === "shuttle") return value.toFixed(1);
  return String(value);
}

function getBest(
  a1: string,
  a2: string,
  better: "higher" | "lower",
  stationId: string,
  absent?: boolean
) {
  if (absent) return "";

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

// 0 = none
// 1 = attempt 1 best
// 2 = attempt 2 best
// 3 = both equal best
function getBestAttempt(a1: string, a2: string, better: "higher" | "lower", absent?: boolean) {
  if (absent) return 0;

  const v1 = parseFloat(a1);
  const v2 = parseFloat(a2);

  if (Number.isNaN(v1) && Number.isNaN(v2)) return 0;
  if (!Number.isNaN(v1) && Number.isNaN(v2)) return 1;
  if (Number.isNaN(v1) && !Number.isNaN(v2)) return 2;

  if (v1 === v2) return 3;

  if (better === "lower") return v1 < v2 ? 1 : 2;
  return v1 > v2 ? 1 : 2;
}

function statusStyles(status: GroupStatusValue) {
  if (status === "completed") {
    return {
      border: "1px solid #86efac",
      background: "#f0fdf4",
      label: "Completed",
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

function getValidationConfig(stationId: string) {
  switch (stationId) {
    case "situp":
      return { maxLength: 2 };
    case "broadjump":
      return { maxLength: 3 };
    case "sitreach":
      return { maxLength: 2 };
    case "ipu":
      return { maxLength: 2 };
    case "shuttle":
      return { maxLength: 4 };
    default:
      return { maxLength: 3 };
  }
}

// Shuttle fix included:
// allows 9, 9., 9.3, 12, 12., 12.4 while typing
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

    const hasDot = cleaned.includes(".");
    const parts = cleaned.split(".");
    const whole = (parts[0] || "").slice(0, 2);
    const decimal = (parts[1] || "").slice(0, 1);

    if (hasDot) {
      return decimal !== "" ? `${whole}.${decimal}` : `${whole}.`;
    }

    return whole;
  }

  const digitsOnly = raw.replace(/\D/g, "");

  if (stationId === "broadjump") return digitsOnly.slice(0, 3);
  return digitsOnly.slice(0, 2);
}

function isValidValueForStation(value: string, stationId: string) {
  if (value === "") return true;

  if (stationId === "shuttle") {
    return /^\d{1,2}(\.\d?)?$/.test(value);
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
    throw new Error(`Non-JSON response from server: ${text.slice(0, 200)}`);
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
  const [groupStatuses, setGroupStatuses] = useState<Record<string, GroupStatusValue>>({});
  const [selectedGroup, setSelectedGroup] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<string, Student[]>>({});

  const [groupsByClass, setGroupsByClass] = useState<Record<string, string[]>>({});
  const [statusesByClassStation, setStatusesByClassStation] = useState<
    Record<string, Record<string, GroupStatusValue>>
  >({});

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
      const record = currentScores[student.id] || { a1: "", a2: "", absent: false };
      return record.absent || record.a1 !== "" || record.a2 !== "";
    }).length;
  }, [students, currentScores]);

  const hasData = useMemo(() => {
    return Object.values(currentScores).some(
      (record) => record.absent || record.a1 !== "" || record.a2 !== ""
    );
  }, [currentScores]);

  const hasPendingSaves = useMemo(() => {
    return Object.values(currentRowSaveState).some(
      (state) => state === "typing" || state === "saving"
    );
  }, [currentRowSaveState]);

  useEffect(() => {
    if (page !== "groups") return;
    if (classes.length > 0) return;

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
        setError(err instanceof Error ? err.message : "Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };

    void loadClasses();
  }, [page, classes.length, selectedClass]);

  useEffect(() => {
    if (!selectedClass || page !== "groups") return;

    const statusKey = `${selectedClass}::${currentStation.id}`;

    const loadGroupsAndStatuses = async () => {
      try {
        setLoadingGroups(true);
        setError("");

        let nextGroups = groupsByClass[selectedClass];

        if (!nextGroups) {
          const groupsData = await fetchJson(
            `${API_BASE}?action=getGroups&className=${encodeURIComponent(selectedClass)}`
          );
          nextGroups = Array.isArray(groupsData.groups) ? groupsData.groups : [];

          setGroupsByClass((prev) => ({
            ...prev,
            [selectedClass]: nextGroups || [],
          }));
        }

        setGroups(nextGroups || []);

        let nextStatuses = statusesByClassStation[statusKey];

        if (!nextStatuses) {
          const statusesData = await fetchJson(
            `${API_BASE}?action=getGroupStatuses&className=${encodeURIComponent(
              selectedClass
            )}&stationId=${encodeURIComponent(currentStation.id)}`
          );

          const map: Record<string, GroupStatusValue> = {};
          const statuses = Array.isArray(statusesData.statuses) ? statusesData.statuses : [];

          statuses.forEach((item: { group: string; status: GroupStatusValue }) => {
            if (item?.group) map[item.group] = item.status;
          });

          nextStatuses = map;

          setStatusesByClassStation((prev) => ({
            ...prev,
            [statusKey]: map,
          }));
        }

        setGroupStatuses(nextStatuses || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load groups");
      } finally {
        setLoadingGroups(false);
      }
    };

    void loadGroupsAndStatuses();
  }, [selectedClass, currentStation.id, page, groupsByClass, statusesByClassStation]);

  useEffect(() => {
    if (!selectedGroup) return;

    if (studentsByGroup[selectedGroup]) {
      setStudents(studentsByGroup[selectedGroup]);
      setLoadingStudents(false);
    }
  }, [selectedGroup, studentsByGroup]);

  const updateGroupStatusLocally = (
    groupKey: string,
    records: Record<string, ScoreRecord>,
    studentsList: Student[]
  ) => {
    const completed = studentsList.filter((student) => {
      const r = records[student.id];
      return r && (r.absent || r.a1 !== "" || r.a2 !== "");
    }).length;

    let status: GroupStatusValue = "not-started";
    if (completed === 0) {
      status = "not-started";
    } else if (completed === studentsList.length && studentsList.length > 0) {
      status = "completed";
    } else {
      status = "in-progress";
    }

    setGroupStatuses((prev) => ({
      ...prev,
      [groupKey]: status,
    }));

    if (selectedClass) {
      const statusKey = `${selectedClass}::${currentStation.id}`;
      setStatusesByClassStation((prev) => ({
        ...prev,
        [statusKey]: {
          ...(prev[statusKey] || {}),
          [groupKey]: status,
        },
      }));
    }
  };

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
        body: JSON.stringify({
          action: "saveAttempt",
          teacher: teacher.trim(),
          stationId: currentStation.id,
          stationLabel: currentStation.label,
          className: selectedClass,
          group: groupKey,
          studentId,
          attempt1: record.absent ? "" : record.a1,
          attempt2: record.absent ? "" : record.a2,
          absent: !!record.absent,
        }),
      });

      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: {
          ...(prev[groupKey] || {}),
          [studentId]: "saved",
        },
      }));

      const nextGroupScores = {
        ...(scoresByGroup[groupKey] || {}),
        [studentId]: record,
      };
      updateGroupStatusLocally(groupKey, nextGroupScores, students);
    } catch (err) {
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

    const current = (scoresByGroup[groupKey] || {})[studentId] || {
      a1: "",
      a2: "",
      absent: false,
    };

    const nextRecord: ScoreRecord = {
      ...current,
      absent: false,
      [key]: cleaned,
    };

    const nextGroupScores = {
      ...(scoresByGroup[groupKey] || {}),
      [studentId]: nextRecord,
    };

    setScoresByGroup((prev) => ({
      ...prev,
      [groupKey]: nextGroupScores,
    }));

    setRowSaveStateByGroup((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [studentId]: "typing",
      },
    }));

    setError("");
    updateGroupStatusLocally(groupKey, nextGroupScores, students);

    const timerKey = `${groupKey}::${studentId}`;

    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }

    const timer = window.setTimeout(() => {
      void saveAttemptNow(groupKey, studentId, nextRecord);
    }, 800);

    saveTimersRef.current[timerKey] = timer;
  };

  const handleAbsentToggle = (studentId: string, checked: boolean) => {
    const groupKey = selectedGroup;

    const nextRecord: ScoreRecord = checked
      ? { a1: "", a2: "", absent: true }
      : { a1: "", a2: "", absent: false };

    const nextGroupScores = {
      ...(scoresByGroup[groupKey] || {}),
      [studentId]: nextRecord,
    };

    setScoresByGroup((prev) => ({
      ...prev,
      [groupKey]: nextGroupScores,
    }));

    setRowSaveStateByGroup((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [studentId]: "typing",
      },
    }));

    setError("");
    updateGroupStatusLocally(groupKey, nextGroupScores, students);

    const timerKey = `${groupKey}::${studentId}`;

    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }

    const timer = window.setTimeout(() => {
      void saveAttemptNow(groupKey, studentId, nextRecord);
    }, 300);

    saveTimersRef.current[timerKey] = timer;
  };

  const loadGroupScores = async (group: string) => {
    if (!selectedClass || !group || !currentStation.id) return;

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
          absent: row.absent === true || String(row.absent).toLowerCase() === "true",
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
      if (r.absent || r.a1 !== "" || r.a2 !== "") {
        saveStateMap[studentId] = "saved";
      }
    });

    setRowSaveStateByGroup((prev) => ({
      ...prev,
      [group]: saveStateMap,
    }));

    updateGroupStatusLocally(group, mappedScores, studentsByGroup[group] || students);
  };

  const handleLoadGroup = async (group: string) => {
    if (!selectedClass || !group || !currentStation.id) return;

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

    const confirm1 = window.confirm(
      `This will clear all saved values for ${selectedGroup}.\n\nContinue?`
    );
    if (!confirm1) return;

    const confirm2 = window.confirm("This cannot be undone.\n\nAre you absolutely sure?");
    if (!confirm2) return;

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
        clearedScores[student.id] = { a1: "", a2: "", absent: false };
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

      updateGroupStatusLocally(selectedGroup, clearedScores, students);
      setMessage(`${selectedGroup} cleared successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearingGroup(false);
    }
  };

  const resetSessionForStationChange = (stationId: string) => {
    setStation(stationId);
    setSelectedClass("");
    setSelectedGroup("");
    setStudents([]);
    setGroups([]);
    setGroupStatuses({});
    setMessage("");
    setError("");
    setPage("groups");
  };

  if (page === "login") {
    return (
      <div style={ui.page}>
        <h1 style={ui.sectionTitle}>NAPFA Station Recorder</h1>
        <div style={ui.sectionSub}>Teacher session setup</div>

        {error && <div style={ui.errorBox}>{error}</div>}

        <div style={{ ...ui.card, padding: 20, marginTop: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 0, marginBottom: 10 }}>Teacher</h2>
          <input
            value={teacher}
            onChange={(e) => {
              setTeacher(e.target.value);
              setError("");
              setMessage("");
            }}
            style={{
              ...ui.input,
              maxWidth: 360,
              fontSize: 20,
              minHeight: 60,
            }}
          />

          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 26, marginBottom: 12 }}>
            Station
          </h2>
          <div
            style={{
              display: "grid",
              gap: 12,
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
                  setStudents([]);
                  setGroups([]);
                  setGroupStatuses({});
                  setMessage("");
                  setError("");
                }}
                style={{
                  ...ui.card,
                  padding: "18px 18px",
                  borderRadius: 18,
                  border: station === s.id ? "2px solid #0f172a" : "1px solid #cbd5e1",
                  background: station === s.id ? "#0f172a" : "#ffffff",
                  color: station === s.id ? "#ffffff" : "#0f172a",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "left",
                  minHeight: 72,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
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
              style={ui.primaryButton}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === "groups") {
    return (
      <div style={ui.page}>
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
            <h1 style={ui.sectionTitle}>Select Group</h1>
            <div style={ui.sectionSub}>
              Teacher: {teacher || "—"} • Station: {currentStation.label}
            </div>
          </div>
          <button
            onClick={() => {
              setMessage("");
              setError("");
              setPage("login");
            }}
            style={ui.secondaryButton}
          >
            Back
          </button>
        </div>

        <div
          style={{
            marginBottom: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => resetSessionForStationChange(s.id)}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: station === s.id ? "#0f172a" : "#fff",
                color: station === s.id ? "#fff" : "#0f172a",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {message && <div style={ui.successBox}>{message}</div>}
        {error && <div style={ui.errorBox}>{error}</div>}

        <div style={{ ...ui.card, padding: 18, marginBottom: 18 }}>
          <div style={{ marginBottom: 8, fontWeight: 800, fontSize: 16 }}>Class</div>
          {loadingClasses ? (
            <div>Loading classes...</div>
          ) : (
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedGroup("");
                setStudents([]);
                setMessage("");
                setError("");
              }}
              style={{
                ...ui.input,
                minWidth: 240,
                maxWidth: 300,
                fontSize: 18,
                minHeight: 58,
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
              gap: 14,
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
                    ...ui.card,
                    padding: 20,
                    borderRadius: 18,
                    cursor: "pointer",
                    textAlign: "left",
                    border: style.border,
                    background: style.background,
                    minHeight: 120,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{g}</div>
                  <div style={{ color: "#64748b", marginBottom: 12, fontSize: 15 }}>
                    Tap to open this group
                  </div>
                  <div style={{ fontWeight: 800, color: style.labelColor, fontSize: 15 }}>
                    {style.label}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={ui.page}>
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
          <h1 style={ui.sectionTitle}>Score Entry</h1>
          <div style={ui.sectionSub}>
            Teacher: {teacher || "—"} • Station: {currentStation.label} • Class: {selectedClass} •
            Group: {selectedGroup}
          </div>
        </div>
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 999,
            background: "#0f172a",
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 10px rgba(15, 23, 42, 0.18)",
          }}
        >
          {loadingStudents ? "Opening group..." : `${completionCount} / ${students.length} completed`}
        </div>
      </div>

      {message && <div style={ui.successBox}>{message}</div>}
      {error && <div style={ui.errorBox}>{error}</div>}

      {loadingStudents && (
        <div
          style={{
            ...ui.card,
            padding: 16,
            marginBottom: 16,
          }}
        >
          Loading students...
        </div>
      )}

      {students.map((s, index) => {
        const rec = currentScores[s.id] || { a1: "", a2: "", absent: false };
        const best = getBest(rec.a1, rec.a2, currentStation.better, currentStation.id, rec.absent);
        const bestAttempt = getBestAttempt(
          rec.a1,
          rec.a2,
          currentStation.better,
          rec.absent
        );
        const saveState = currentRowSaveState[s.id] || "";

        const a1Valid = isValidValueForStation(rec.a1, currentStation.id);
        const a2Valid = isValidValueForStation(rec.a2, currentStation.id);

        return (
          <div
            key={s.id}
            id={`row-${s.id}`}
            style={{
              ...ui.card,
              borderRadius: 20,
              marginBottom: 16,
              padding: 18,
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
                <div style={{ fontWeight: 800, fontSize: 22, color: "#0f172a" }}>
                  {s.no}. {s.name}
                </div>
                <div style={{ color: "#64748b", marginTop: 4, marginBottom: 14, fontSize: 15 }}>
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

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
                padding: "10px 14px",
                borderRadius: 14,
                background: rec.absent ? "#fef2f2" : "#f8fafc",
                border: rec.absent ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                fontSize: 15,
              }}
            >
              <input
                type="checkbox"
                checked={!!rec.absent}
                onChange={(e) => handleAbsentToggle(s.id, e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span
                style={{
                  fontWeight: 700,
                  color: rec.absent ? "#b91c1c" : "#475569",
                }}
              >
                Absent
              </span>
            </label>

            <div
              style={{
                display: "grid",
                columnGap: 36,
                rowGap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                  Attempt 1
                </div>
                <input
                  placeholder=""
                  value={rec.a1}
                  disabled={!!rec.absent}
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
                    ...ui.input,
                    border: !a1Valid
                      ? "2px solid #dc2626"
                      : bestAttempt === 1 || bestAttempt === 3
                      ? "2px solid #16a34a"
                      : "1px solid #cbd5e1",
                    background: rec.absent
                      ? "#f3f4f6"
                      : bestAttempt === 1 || bestAttempt === 3
                      ? "#f0fdf4"
                      : "#fff",
                  }}
                />
                {!a1Valid && !rec.absent && (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>
                    Invalid value
                  </div>
                )}
                {(bestAttempt === 1 || bestAttempt === 3) && a1Valid && !rec.absent && (
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
                <div style={{ marginBottom: 8, fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                  Attempt 2
                </div>
                <input
                  placeholder=""
                  value={rec.a2}
                  disabled={!!rec.absent}
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
                    ...ui.input,
                    border: !a2Valid
                      ? "2px solid #dc2626"
                      : bestAttempt === 2 || bestAttempt === 3
                      ? "2px solid #16a34a"
                      : "1px solid #cbd5e1",
                    background: rec.absent
                      ? "#f3f4f6"
                      : bestAttempt === 2 || bestAttempt === 3
                      ? "#f0fdf4"
                      : "#fff",
                  }}
                />
                {!a2Valid && !rec.absent && (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>
                    Invalid value
                  </div>
                )}
                {(bestAttempt === 2 || bestAttempt === 3) && a2Valid && !rec.absent && (
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
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                background: "#f8fafc",
                fontWeight: 800,
                fontSize: 16,
                boxShadow: "inset 0 0 0 1px #e2e8f0",
                color: "#0f172a",
              }}
            >
              Best Score: {rec.absent ? "Absent" : best ? `${best} ${currentStation.unit}` : "—"}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "rgba(248, 250, 252, 0.92)",
          backdropFilter: "blur(10px)",
          paddingTop: 12,
          paddingBottom: 8,
          display: "flex",
          gap: 12,
        }}
      >
        <button
          onClick={handleEntryBack}
          style={{
            ...ui.secondaryButton,
            flex: 1,
          }}
        >
          Back
        </button>

        <button
          onClick={() => void handleClearGroup()}
          disabled={!hasData || clearingGroup}
          style={{
            ...ui.dangerButton,
            flex: 1,
            opacity: !hasData || clearingGroup ? 0.6 : 1,
            cursor: !hasData || clearingGroup ? "not-allowed" : "pointer",
          }}
        >
          {clearingGroup ? "Clearing..." : "Clear Group"}
        </button>
      </div>
    </div>
  );
}
