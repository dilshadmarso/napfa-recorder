import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Clock3, ClipboardCheck, Loader2, User2 } from "lucide-react";

const API_BASE = "https://script.google.com/macros/s/AKfycbyueZpK7QN12YHEysw6YOSZ8wa2Mi_VVfeJcjkH3g1rCzO8WNPbRz68knNzYK5-lSRb/exec";
const USE_LIVE_API = true;
const USE_MOCK_FALLBACK = false;

const mockClasses = ["P6-RT"];
const mockStatuses = [
  { group: "P6-RT.G1", status: "not-started" },
  { group: "P6-RT.G2", status: "not-started" },
  { group: "P6-RT.G3", status: "not-started" },
  { group: "P6-RT.G4", status: "not-started" },
  { group: "P6-RT.G5", status: "not-started" },
];
const mockStudents = {
  "P6-RT.G1": [
    { no: 1, name: "AKSHAYA UMAPRASATH", id: "27586338", className: "P6-RT", gender: "F", dob: "04/10/2014", group: "P6-RT.G1" },
    { no: 2, name: "ALYA NAURA BINTE ALIAS", id: "27586492", className: "P6-RT", gender: "F", dob: "28/12/2014", group: "P6-RT.G1" },
    { no: 3, name: "AMILIYA NUR ATIKA BINTE MOHAMAD AZALIE", id: "27586331", className: "P6-RT", gender: "F", dob: "13/03/2014", group: "P6-RT.G1" },
    { no: 4, name: "LIM EN MEI", id: "27682409", className: "P6-RT", gender: "F", dob: "31/07/2013", group: "P6-RT.G1" },
    { no: 5, name: "MIA AZZAHRA BINTE MUHAMMAD HAFIZUDDIN", id: "27586364", className: "P6-RT", gender: "F", dob: "19/05/2014", group: "P6-RT.G1" },
    { no: 6, name: "NIKKI AMELIE BINTE MUHAMMAD NORHAIZAD", id: "27586434", className: "P6-RT", gender: "F", dob: "09/12/2014", group: "P6-RT.G1" },
    { no: 7, name: "NUR AALIYAH SOFEA BINTI ABDULLAH", id: "30842827", className: "P6-RT", gender: "F", dob: "21/11/2014", group: "P6-RT.G1" },
    { no: 8, name: "NUR DIYANAH ISABELLA BINTE MAZLAN", id: "27582567", className: "P6-RT", gender: "F", dob: "11/10/2014", group: "P6-RT.G1" },
  ],
};

const stationOptions = [
  { id: "situp", label: "Sit Up", better: "higher", unit: "reps" },
  { id: "broadjump", label: "Broad Jump", better: "higher", unit: "cm" },
  { id: "sitreach", label: "Sit & Reach", better: "higher", unit: "cm" },
  { id: "ipu", label: "IPU / Pull-up", better: "higher", unit: "reps" },
  { id: "shuttle", label: "Shuttle Run", better: "lower", unit: "s" },
];

const stationApiLabelMap = {
  situp: "Sit Up",
  broadjump: "Broad Jump",
  sitreach: "Sit & Reach",
  ipu: "IPU / Pull-up",
  shuttle: "Shuttle Run",
};

function parseScore(value: string | number | null | undefined) {
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

function getBestInfo(stationId: string, a1: string, a2: string) {
  const station = stationOptions.find((s) => s.id === stationId);
  const v1 = parseScore(a1);
  const v2 = parseScore(a2);

  if (v1 === null && v2 === null) return { best: "", bestAttempt: 0 };
  if (v1 !== null && v2 === null) return { best: String(v1), bestAttempt: 1 };
  if (v1 === null && v2 !== null) return { best: String(v2), bestAttempt: 2 };

  if (station?.better === "lower") {
    if (v1! < v2!) return { best: String(v1), bestAttempt: 1 };
    if (v2! < v1!) return { best: String(v2), bestAttempt: 2 };
    return { best: String(v1), bestAttempt: 0 };
  }

  if (v1! > v2!) return { best: String(v1), bestAttempt: 1 };
  if (v2! > v1!) return { best: String(v2), bestAttempt: 2 };
  return { best: String(v1), bestAttempt: 0 };
}

function runHelperSelfTests() {
  const cases = [
    { stationId: "broadjump", a1: "142", a2: "148", best: "148", bestAttempt: 2 },
    { stationId: "broadjump", a1: "150", a2: "", best: "150", bestAttempt: 1 },
    { stationId: "shuttle", a1: "12.4", a2: "11.9", best: "11.9", bestAttempt: 2 },
    { stationId: "shuttle", a1: "11.8", a2: "12.1", best: "11.8", bestAttempt: 1 },
    { stationId: "situp", a1: "20", a2: "20", best: "20", bestAttempt: 0 },
  ];

  for (const testCase of cases) {
    const result = getBestInfo(testCase.stationId, testCase.a1, testCase.a2);
    if (result.best !== testCase.best || result.bestAttempt !== testCase.bestAttempt) {
      throw new Error(`Helper self-test failed for ${JSON.stringify(testCase)}. Got ${JSON.stringify(result)}`);
    }
  }
}

runHelperSelfTests();

function statusPill(status: string) {
  if (status === "submitted") {
    return (
      <Badge className="rounded-full text-sm">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        Submitted
      </Badge>
    );
  }
  if (status === "in-progress") {
    return (
      <Badge variant="secondary" className="rounded-full text-sm">
        <Clock3 className="mr-1 h-3.5 w-3.5" />
        In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full text-sm">
      Not Started
    </Badge>
  );
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function getMockResponse(url: string, options: RequestInit = {}) {
  const isPost = (options.method || "GET").toUpperCase() === "POST";
  if (isPost) {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    if (body.action === "saveAttempt") {
      const stationId =
        Object.entries(stationApiLabelMap).find(([, label]) => label === body.station)?.[0] || "broadjump";
      const best = getBestInfo(stationId, body.attempt1, body.attempt2).best;
      return { success: true, bestScore: best };
    }
    if (body.action === "submitGroup") {
      return { success: true };
    }
  }

  const u = new URL(url);
  const action = u.searchParams.get("action");
  const className = u.searchParams.get("className");
  const group = u.searchParams.get("group");

  if (action === "getClasses") return { success: true, classes: mockClasses };
  if (action === "getGroupStatuses" && className === "P6-RT") return { success: true, statuses: mockStatuses };
  if (action === "getGroupStudents") return { success: true, students: mockStudents[group as keyof typeof mockStudents] || [] };
  if (action === "getGroups" && className === "P6-RT") {
    return { success: true, groups: mockStatuses.map((x) => x.group) };
  }

  return { success: false, message: "Mock data not found" };
}

async function fetchJsonWithFallback(url: string, options: RequestInit = {}) {
  if (!USE_LIVE_API) {
    return getMockResponse(url, options);
  }

  try {
    return await fetchJson(url, options);
  } catch (err) {
    if (!USE_MOCK_FALLBACK) throw err;
    return getMockResponse(url, options);
  }
}

type ScoreRecord = { a1: string; a2: string };
type InputKey = "a1" | "a2";

export default function NapfaScoreRecorderFrontend() {
  const [page, setPage] = useState("session");
  const [teacherName, setTeacherName] = useState("Dilshad");
  const [station, setStation] = useState("broadjump");

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [groupStatuses, setGroupStatuses] = useState<Array<{ group: string; status: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [students, setStudents] = useState<Array<{ no: number; name: string; id: string; className: string; gender: string; dob: string; group: string }>>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<string, Array<{ no: number; name: string; id: string; className: string; gender: string; dob: string; group: string }>>>({});

  const [scoresByGroup, setScoresByGroup] = useState<Record<string, Record<string, ScoreRecord>>>({});
  const [rowSaveStateByGroup, setRowSaveStateByGroup] = useState<Record<string, Record<string, string>>>({});
  const [saveTimers, setSaveTimers] = useState<Record<string, number>>({});
  const [hasUnsavedNavigation, setHasUnsavedNavigation] = useState(false);

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const activeStation = stationOptions.find((s) => s.id === station);
  const activeStationLabel = stationApiLabelMap[station as keyof typeof stationApiLabelMap];

  useEffect(() => {
    if (page !== "group-select") return;

    const loadClasses = async () => {
      try {
        setLoadingClasses(true);
        setError("");
        const data = await fetchJsonWithFallback(`${API_BASE}?action=getClasses`);
        setClasses(data.classes || []);
        if (!selectedClass && data.classes?.length) {
          setSelectedClass(data.classes[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };

    void loadClasses();
  }, [page, selectedClass]);

  useEffect(() => {
    if (page !== "group-select" || !selectedClass || !activeStationLabel) return;

    const loadStatuses = async () => {
      try {
        setLoadingGroups(true);
        setError("");
        const data = await fetchJsonWithFallback(
          `${API_BASE}?action=getGroupStatuses&className=${encodeURIComponent(selectedClass)}&station=${encodeURIComponent(activeStationLabel)}`,
        );
        const nextStatuses = data.statuses || [];
        setGroupStatuses(nextStatuses);

        nextStatuses.forEach((item: { group: string }) => {
          if (studentsByGroup[item.group]) return;

          void fetchJsonWithFallback(
            `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(selectedClass)}&group=${encodeURIComponent(item.group)}`,
          )
            .then((groupData) => {
              setStudentsByGroup((prev) => ({
                ...prev,
                [item.group]: groupData.students || [],
              }));
            })
            .catch((err) => {
              console.error(`Unable to preload ${item.group}`, err);
            });
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load groups");
      } finally {
        setLoadingGroups(false);
      }
    };

    void loadStatuses();
  }, [page, selectedClass, station, activeStationLabel, studentsByGroup]);

  const currentScores = scoresByGroup[selectedGroup] || {};
  const currentRowSaveState = rowSaveStateByGroup[selectedGroup] || {};

  const completionCount = useMemo(() => {
    return students.filter((student) => {
      const record = currentScores[student.id] || { a1: "", a2: "" };
      return record.a1 !== "" || record.a2 !== "";
    }).length;
  }, [students, currentScores]);

  const hasData = useMemo(() => {
    return Object.values(currentScores).some((record) => record.a1 !== "" || record.a2 !== "");
  }, [currentScores]);

  const focusInput = (studentIndex: number, key: InputKey) => {
    const element = document.getElementById(`input-${studentIndex}-${key}`) as HTMLInputElement | null;
    element?.focus();
    element?.select();
  };

  const saveAttemptNow = async (groupKey: string, studentId: string, record: ScoreRecord) => {
    try {
      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: { ...(prev[groupKey] || {}), [studentId]: "saving" },
      }));
      await fetchJsonWithFallback(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "saveAttempt",
          teacher: teacherName,
          station: activeStationLabel,
          className: selectedClass,
          group: groupKey,
          studentId,
          attempt1: record.a1,
          attempt2: record.a2,
        }),
      });
      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: { ...(prev[groupKey] || {}), [studentId]: "saved" },
      }));
    } catch (err) {
      setRowSaveStateByGroup((prev) => ({
        ...prev,
        [groupKey]: { ...(prev[groupKey] || {}), [studentId]: "error" },
      }));
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleAttemptChange = (studentId: string, key: keyof ScoreRecord, value: string) => {
    const groupKey = selectedGroup;
    const existingGroupScores = scoresByGroup[groupKey] || {};
    const nextRecord = {
      ...(existingGroupScores[studentId] || { a1: "", a2: "" }),
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

    setHasUnsavedNavigation(true);

    const timerKey = `${groupKey}::${studentId}`;
    if (saveTimers[timerKey]) {
      window.clearTimeout(saveTimers[timerKey]);
    }

    const timer = window.setTimeout(() => {
      void saveAttemptNow(groupKey, studentId, nextRecord);
    }, 800);

    setSaveTimers((prev) => ({ ...prev, [timerKey]: timer }));
  };

  const handleLoadGroup = async (group: string) => {
    try {
      setSelectedGroup(group);
      setPage("entry");
      setLoadingStudents(true);
      setError("");
      setSubmitMessage("");

      if (studentsByGroup[group]) {
        setStudents(studentsByGroup[group]);
        setLoadingStudents(false);
        return;
      }

      const data = await fetchJsonWithFallback(
        `${API_BASE}?action=getGroupStudents&className=${encodeURIComponent(selectedClass)}&group=${encodeURIComponent(group)}`,
      );
      const nextStudents = data.students || [];
      setStudentsByGroup((prev) => ({ ...prev, [group]: nextStudents }));
      setStudents(nextStudents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleEntryBack = () => {
    if (hasData && hasUnsavedNavigation) {
      const confirmed = window.confirm("Go back without submitting this group?");
      if (!confirmed) return;
    }

    setPage("group-select");
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

      await fetchJsonWithFallback(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submitGroup",
          teacher: teacherName,
          station: activeStationLabel,
          className: selectedClass,
          group: selectedGroup,
        }),
      });

      setSubmitMessage(`${selectedGroup} submitted for ${activeStationLabel}.`);
      setSelectedGroup("");
      setStudents([]);
      setPage("group-select");
      setHasUnsavedNavigation(false);

      const refreshed = await fetchJsonWithFallback(
        `${API_BASE}?action=getGroupStatuses&className=${encodeURIComponent(selectedClass)}&station=${encodeURIComponent(activeStationLabel)}`,
      );
      setGroupStatuses(refreshed.statuses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {page === "session" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">NAPFA Station Recorder</h1>
              <p className="mt-1 text-slate-600">
                Deployment version. This build uses the live Google Apps Script backend.
              </p>
            </div>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User2 className="h-5 w-5" /> Teacher Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base">Teacher Name</Label>
                  <Input className="h-14 rounded-2xl text-lg" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
                </div>

                <div className="space-y-3">
                  <Label className="text-base">Select Station</Label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {stationOptions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setStation(item.id)}
                        className={`rounded-3xl border p-5 text-left text-lg font-semibold transition ${
                          station === item.id ? "border-slate-900 bg-slate-900 text-white" : "bg-white hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button className="h-14 w-full rounded-3xl text-lg" onClick={() => setPage("group-select")}>
                  Start Session
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {page === "group-select" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Select Group</h1>
                <p className="mt-1 text-slate-600">
                  Teacher: {teacherName} • Station: {activeStationLabel}
                </p>
              </div>
              <Button variant="outline" className="rounded-2xl" onClick={() => setPage("session")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>

            <Card className="rounded-3xl shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label className="text-base">Class</Label>
                  {loadingClasses ? (
                    <div className="flex h-14 items-center rounded-2xl border bg-white px-4 text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading classes...
                    </div>
                  ) : (
                    <select
                      className="h-14 w-full rounded-2xl border bg-white px-4 text-lg"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      {classes.map((className) => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {submitMessage && <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">{submitMessage}</div>}
                {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}

                {loadingGroups ? (
                  <div className="flex items-center rounded-2xl border bg-white p-5 text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading groups...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {groupStatuses.map((item) => (
                      <button
                        key={item.group}
                        onClick={() => handleLoadGroup(item.group)}
                        className="rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xl font-semibold">{item.group}</p>
                            <p className="mt-1 text-sm text-slate-500">Tap to load this group</p>
                          </div>
                          {statusPill(item.status)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {page === "entry" && (
          <div className="space-y-6 pb-28">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Score Entry</h1>
                <p className="mt-1 text-slate-600">
                  Teacher: {teacherName} • Station: {activeStationLabel} • Class: {selectedClass} • Group: {selectedGroup}
                </p>
              </div>
              <Badge className="rounded-full px-4 py-2 text-sm">
                {loadingStudents ? "Opening group..." : `${completionCount} / ${students.length} entered`}
              </Badge>
            </div>

            {error && <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</div>}
            {loadingStudents && (
              <div className="flex items-center rounded-2xl border bg-white p-5 text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading students...
              </div>
            )}

            <div className="space-y-4">
              {students.map((student, index) => {
                const record = currentScores[student.id] || { a1: "", a2: "" };
                const bestInfo = getBestInfo(station, record.a1, record.a2);
                const unit = activeStation?.unit ? ` ${activeStation.unit}` : "";
                const saveState = currentRowSaveState[student.id] || "";

                return (
                  <Card key={student.id} className="rounded-3xl shadow-sm">
                    <CardContent className="space-y-5 p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-semibold leading-snug">{student.no}. {student.name}</p>
                          <p className="mt-1 text-base text-slate-500">
                            {student.gender} • {student.group}
                          </p>
                        </div>
                        <div className="text-sm" style={{ color: saveState === "error" ? "#b91c1c" : saveState === "saved" ? "#166534" : "#666", fontWeight: saveState === "saved" || saveState === "error" ? 700 : 500 }}>
                          {saveState === "saving" && "Saving..."}
                          {saveState === "saved" && "Saved"}
                          {saveState === "typing" && "Typing..."}
                          {saveState === "error" && "Save failed"}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-base">Attempt 1</Label>
                          <div className="relative">
                            <Input
                              className={`h-16 rounded-2xl pr-20 text-2xl ${bestInfo.bestAttempt === 1 ? "border-emerald-500 bg-emerald-50" : ""}`}
                              inputMode={station === "shuttle" ? "decimal" : "numeric"}
                              pattern={station === "shuttle" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
                              enterKeyHint="next"
                              id={`input-${index}-a1`}
                              value={record.a1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  focusInput(index, "a2");
                                }
                              }}
                              onChange={(e) => handleAttemptChange(student.id, "a1", e.target.value)}
                              placeholder={activeStation?.unit || "score"}
                            />
                            {bestInfo.bestAttempt === 1 && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm">
                                Best
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base">Attempt 2</Label>
                          <div className="relative">
                            <Input
                              className={`h-16 rounded-2xl pr-20 text-2xl ${bestInfo.bestAttempt === 2 ? "border-emerald-500 bg-emerald-50" : ""}`}
                              inputMode={station === "shuttle" ? "decimal" : "numeric"}
                              pattern={station === "shuttle" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
                              enterKeyHint={index < students.length - 1 ? "next" : "done"}
                              id={`input-${index}-a2`}
                              value={record.a2}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (index < students.length - 1) {
                                    focusInput(index + 1, "a1");
                                  }
                                }
                              }}
                              onChange={(e) => handleAttemptChange(student.id, "a2", e.target.value)}
                              placeholder={activeStation?.unit || "score"}
                            />
                            {bestInfo.bestAttempt === 2 && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm">
                                Best
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-base ring-1 ring-slate-200">
                        <span className="font-semibold">Best Score:</span>
                        <span className="ml-2">{bestInfo.best ? `${bestInfo.best}${unit}` : "—"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur">
              <div className="mx-auto flex max-w-5xl gap-3 p-4">
                <Button variant="outline" className="h-14 flex-1 rounded-3xl text-lg" onClick={handleEntryBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="h-14 flex-1 rounded-3xl text-lg" onClick={handleSubmit} disabled={!hasData || submitting}>
                  {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ClipboardCheck className="mr-2 h-5 w-5" />}
                  Save & Submit
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
