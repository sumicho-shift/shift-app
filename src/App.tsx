import React, { useEffect, useMemo, useState } from "react";

type ViewMode = "day" | "week" | "month";
type ShiftType = "early" | "late" | "full";
type MealType = "none" | "with";

type ShiftRecord = {
  id: number;
  employee: string;
  date: string;
  shiftType: ShiftType;
  shiftLabel: string;
  shiftIcon: string;
  start: string;
  end: string;
  mealType: MealType;
  mealCost: number;
  wage: number;
  total: number;
  memo: string;
};

const STORAGE_KEY = "shift_timetree_final_polished_v1";
const EMPLOYEE_KEY = "shift_timetree_final_polished_employees_v1";
const HOURLY_WAGE = 1200;

const defaultEmployees = ["田中", "山田", "佐藤", "中村"];

const employeeColorMap: Record<string, string> = {
  田中: "#FCA5A5",
  山田: "#93C5FD",
  佐藤: "#86EFAC",
  中村: "#FDE68A",
};

const fallbackColors = [
  "#F9A8D4",
  "#A5B4FC",
  "#67E8F9",
  "#C4B5FD",
  "#FDBA74",
  "#7DD3FC",
  "#FCD34D",
  "#A7F3D0",
];

const shiftPreset: Record<
  ShiftType,
  { label: string; icon: string; start: string; end: string }
> = {
  early: { label: "早番", icon: "☀️", start: "17:00", end: "20:00" },
  late: { label: "遅番", icon: "🌙", start: "20:00", end: "23:00" },
  full: { label: "通し", icon: "🔥", start: "17:00", end: "23:00" },
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function displayDateJP(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function displayMonthJP(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
  });
}

function calcHours(start: string, end: string): number {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return eh - sh;
}

function getMonthCells(baseDate: Date): Date[] {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function getWeekCells(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() - baseDate.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function downloadCsv(rows: ShiftRecord[]) {
  const headers = [
    "ID",
    "従業員",
    "日付",
    "シフト",
    "開始",
    "終了",
    "ごはん区分",
    "ごはん代",
    "時給分",
    "総支給額",
    "メモ",
  ];

  const csvRows = rows.map((row) => [
    row.id,
    row.employee,
    row.date,
    row.shiftLabel,
    row.start,
    row.end,
    row.mealType === "with" ? "あり" : "なし",
    row.mealCost,
    row.wage,
    row.total,
    row.memo,
  ]);

  const csv = [headers, ...csvRows]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shift-export-${formatDate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [records, setRecords] = useState<ShiftRecord[]>([]);
  const [employees, setEmployees] = useState<string[]>(defaultEmployees);
  const [newEmployee, setNewEmployee] = useState("");
  const [message, setMessage] = useState("");

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [employee, setEmployee] = useState(defaultEmployees[0]);
  const [shiftType, setShiftType] = useState<ShiftType>("early");
  const [mealType, setMealType] = useState<MealType>("none");
  const [mealCost, setMealCost] = useState("");
  const [memo, setMemo] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const savedRecords = localStorage.getItem(STORAGE_KEY);
    const savedEmployees = localStorage.getItem(EMPLOYEE_KEY);

    if (savedRecords) {
      try {
        setRecords(JSON.parse(savedRecords));
      } catch (e) {
        console.error("records load error", e);
      }
    }

    if (savedEmployees) {
      try {
        const parsed = JSON.parse(savedEmployees);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmployees(parsed);
          setEmployee(parsed[0]);
        }
      } catch (e) {
        console.error("employees load error", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    if (!employees.includes(employee) && employees.length > 0) {
      setEmployee(employees[0]);
    }
  }, [employees, employee]);

  const currentPreset = shiftPreset[shiftType];
  const hours = calcHours(currentPreset.start, currentPreset.end);
  const wage = hours * HOURLY_WAGE;
  const meal =
    shiftType === "full" && mealType === "with" ? Number(mealCost || 0) : 0;
  const total = wage + meal;

  const selectedDateStr = formatDate(selectedDate);

  const recordsByDate = useMemo(() => {
    return records.reduce((acc: Record<string, ShiftRecord[]>, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [records]);

  const selectedDayRecords = records
    .filter((r) => r.date === selectedDateStr)
    .sort((a, b) => a.start.localeCompare(b.start));

  const todayData = records
    .filter((r) => r.date === formatDate(new Date()))
    .sort((a, b) => a.start.localeCompare(b.start));

  const filteredSaved =
    filterEmployee === "all"
      ? records
      : records.filter((r) => r.employee === filterEmployee);

  const monthCells = useMemo(() => getMonthCells(currentDate), [currentDate]);
  const weekCells = useMemo(() => getWeekCells(currentDate), [currentDate]);

  const selectedMonthKey = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, "0")}`;

  const monthRecords = filteredSaved.filter((r) =>
    r.date.startsWith(selectedMonthKey)
  );

  const wageTotal = monthRecords.reduce((sum, r) => sum + r.wage, 0);
  const mealTotal = monthRecords.reduce((sum, r) => sum + r.mealCost, 0);
  const grandTotal = monthRecords.reduce((sum, r) => sum + r.total, 0);

  const byEmployee = monthRecords.reduce(
    (
      acc: Record<string, { wage: number; meal: number; total: number }>,
      item
    ) => {
      if (!acc[item.employee]) {
        acc[item.employee] = { wage: 0, meal: 0, total: 0 };
      }
      acc[item.employee].wage += item.wage;
      acc[item.employee].meal += item.mealCost;
      acc[item.employee].total += item.total;
      return acc;
    },
    {}
  );

  const getEmployeeColor = (name: string) => {
    if (employeeColorMap[name]) return employeeColorMap[name];
    const idx = employees.indexOf(name);
    return fallbackColors[idx % fallbackColors.length];
  };

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2000);
  };

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 1800);
  };

  const movePeriod = (num: number) => {
    const next = new Date(currentDate);

    if (viewMode === "day") {
      next.setDate(next.getDate() + num);
      setCurrentDate(next);
      setSelectedDate(next);
      return;
    }

    if (viewMode === "week") {
      next.setDate(next.getDate() + num * 7);
      setCurrentDate(next);
      return;
    }

    next.setMonth(next.getMonth() + num);
    setCurrentDate(next);
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleShiftChange = (type: ShiftType) => {
    setShiftType(type);
    if (type !== "full") {
      setMealType("none");
      setMealCost("");
    }
  };

  const handleAddEmployee = () => {
    const trimmed = newEmployee.trim();
    if (!trimmed) {
      showMessage("従業員名入れてな");
      return;
    }

    if (employees.includes(trimmed)) {
      showMessage("その名前はもうあるで");
      return;
    }

    const next = [...employees, trimmed];
    setEmployees(next);
    setEmployee(trimmed);
    setNewEmployee("");
    showMessage("従業員追加したで🙌");
  };

  const handleSave = () => {
    const newItem: ShiftRecord = {
      id: Date.now(),
      employee,
      date: formatDate(selectedDate),
      shiftType,
      shiftLabel: currentPreset.label,
      shiftIcon: currentPreset.icon,
      start: currentPreset.start,
      end: currentPreset.end,
      mealType: shiftType === "full" ? mealType : "none",
      mealCost: shiftType === "full" ? meal : 0,
      wage,
      total,
      memo,
    };

    setRecords([newItem, ...records]);
    setMemo("");
    if (shiftType !== "full") {
      setMealType("none");
      setMealCost("");
    }
    setShowModal(false);

    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    showToast("保存したで👍");
  };

  const handleDelete = (id: number) => {
    setRecords(records.filter((r) => r.id !== id));
    showToast("削除したで");
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "12px 12px",
    borderRadius: 14,
    border: active ? "1px solid #2563eb" : "1px solid #dbe2ea",
    background: active ? "#2563eb" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: active ? "0 8px 20px rgba(37,99,235,0.18)" : "none",
  });

  const shiftButtonStyle = (type: ShiftType): React.CSSProperties => ({
    flex: 1,
    padding: "14px 10px",
    background: shiftType === type ? "#111827" : "#f3f4f6",
    color: shiftType === type ? "#fff" : "#111827",
    border: shiftType === type ? "1px solid #111827" : "1px solid #d1d5db",
    borderRadius: 12,
    fontWeight: "bold",
    fontSize: 15,
    cursor: "pointer",
  });

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
    background: "#ffffff",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    marginBottom: 18,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #f7f8fc 30%, #ffffff 100%)",
        padding: 16,
        fontFamily: "sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: "0 auto",
          paddingBottom: 90,
          transform: flash ? "scale(1.01)" : "scale(1)",
          transition: "0.2s ease",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            TimeTree風シンプル版
          </div>
          <h1 style={{ fontSize: 32, margin: 0 }}>住長納屋シフト</h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            style={tabStyle(viewMode === "day")}
            onClick={() => setViewMode("day")}
          >
            日
          </button>
          <button
            style={tabStyle(viewMode === "week")}
            onClick={() => setViewMode("week")}
          >
            週
          </button>
          <button
            style={tabStyle(viewMode === "month")}
            onClick={() => setViewMode("month")}
          >
            月
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => movePeriod(-1)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ←
          </button>

          <button
            onClick={goToday}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            今日
          </button>

          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: 14,
              borderRadius: 14,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              fontWeight: "bold",
              boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
            }}
          >
            {viewMode === "month"
              ? displayMonthJP(currentDate)
              : displayDateJP(currentDate)}
          </div>

          <button
            onClick={() => movePeriod(1)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            →
          </button>
        </div>

        {viewMode === "month" && (
          <div style={cardStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
                <div
                  key={w}
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  {w}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}
            >
              {monthCells.map((cell) => {
                const cellStr = formatDate(cell);
                const items = recordsByDate[cellStr] || [];
                const isCurrentMonth =
                  cell.getMonth() === currentDate.getMonth();
                const isToday = cellStr === formatDate(new Date());
                const isSelected = cellStr === selectedDateStr;

                return (
                  <div
                    key={cellStr}
                    onClick={() => {
                      setSelectedDate(cell);
                      setCurrentDate(cell);
                      setViewMode("day");
                    }}
                    style={{
                      minHeight: 92,
                      padding: 7,
                      borderRadius: 14,
                      border: isSelected
                        ? "2px solid #2563eb"
                        : items.length > 0
                        ? "1px solid #bfdbfe"
                        : "1px solid #e5e7eb",
                      background: isToday ? "#eff6ff" : "#fff",
                      opacity: isCurrentMonth ? 1 : 0.35,
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 10px 24px rgba(37,99,235,0.14)"
                        : items.length > 0
                        ? "0 4px 10px rgba(59,130,246,0.06)"
                        : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        marginBottom: 5,
                      }}
                    >
                      {cell.getDate()}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            background: getEmployeeColor(item.employee),
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 11,
                            color: "#111",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>{item.shiftIcon}</span>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.employee}
                          </span>
                        </div>
                      ))}

                      {items.length > 2 && (
                        <div
                          style={{ fontSize: 11, color: "#666", marginTop: 2 }}
                        >
                          +{items.length - 2}件
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                gap: 10,
                paddingBottom: 10,
              }}
            >
              {weekCells.map((d) => {
                const dateStr = formatDate(d);
                const dayItems = records.filter((r) => r.date === dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      setSelectedDate(d);
                      setCurrentDate(d);
                      setViewMode("day");
                    }}
                    style={{
                      minWidth: 120,
                      background: "#fff",
                      borderRadius: 14,
                      padding: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      cursor: "pointer",
                      border:
                        dateStr === selectedDateStr
                          ? "2px solid #2563eb"
                          : "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{ fontSize: 12, color: "#666", marginBottom: 6 }}
                    >
                      {d.getMonth() + 1}/{d.getDate()}
                    </div>

                    {dayItems.length === 0 && (
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        シフトなし
                      </div>
                    )}

                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: getEmployeeColor(item.employee),
                          borderRadius: 6,
                          padding: "4px 6px",
                          fontSize: 11,
                          marginTop: 6,
                          fontWeight: 600,
                        }}
                      >
                        {item.employee} {item.shiftIcon}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div style={cardStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 10 }}>
              {displayDateJP(selectedDate)}
            </div>

            {selectedDayRecords.length === 0 && (
              <div style={{ color: "#94a3b8" }}>この日はまだシフトないで</div>
            )}

            {selectedDayRecords.map((item) => (
              <div
                key={item.id}
                style={{
                  background: getEmployeeColor(item.employee),
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: "bold" }}>{item.employee}</div>
                <div>
                  {item.shiftLabel} {shiftPreset[item.shiftType].icon}
                </div>
                <div>
                  {item.start} - {item.end}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 24 }}>選択中の日の詳細</h3>
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              fontWeight: "bold",
            }}
          >
            {displayDateJP(selectedDate)}
          </div>

          {selectedDayRecords.length === 0 && (
            <div style={{ color: "#94a3b8" }}>この日はまだシフトないで</div>
          )}

          {selectedDayRecords.map((item) => (
            <div
              key={item.id}
              style={{
                background: getEmployeeColor(item.employee),
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                {item.employee}
              </div>
              <div>
                {item.shiftLabel} {shiftPreset[item.shiftType].icon}
              </div>
              <div>
                {item.start} - {item.end}
              </div>
              <div>時給分: {item.wage}円</div>
              <div>ごはん代: {item.mealCost}円</div>
              {item.memo && <div>メモ: {item.memo}</div>}
              <div style={{ fontWeight: "bold", marginTop: 4 }}>
                総支給額: {item.total}円
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 24 }}>今日のシフト</h3>

          {todayData.length === 0 && <div>今日はまだ入ってへんで</div>}

          {todayData.map((s) => (
            <div
              key={s.id}
              style={{
                background: getEmployeeColor(s.employee),
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: "bold" }}>{s.employee}</div>
              <div>
                {s.shiftLabel} {shiftPreset[s.shiftType].icon} / {s.start} -{" "}
                {s.end}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 24 }}>CSV・集計</h3>

          <button
            onClick={() => downloadCsv(records)}
            style={{
              width: "100%",
              padding: 12,
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: "bold",
              fontSize: 15,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            CSVダウンロード
          </button>

          <div style={{ fontWeight: "bold", marginBottom: 8 }}>
            表示フィルター
          </div>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 16,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 16,
            }}
          >
            <option value="all">全員</option>
            {employees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <h4 style={{ fontSize: 22, marginBottom: 8 }}>
            {selectedMonthKey} の合計
          </h4>
          <div>時給合計: {wageTotal}円</div>
          <div>ごはん代合計: {mealTotal}円</div>
          <div style={{ fontWeight: "bold", fontSize: 18, marginTop: 4 }}>
            総支給額: {grandTotal}円
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h4 style={{ fontSize: 22, marginBottom: 8 }}>従業員ごとの合計</h4>
          {Object.keys(byEmployee).length === 0 && <div>まだデータないで</div>}
          {Object.keys(byEmployee).map((name) => (
            <div
              key={name}
              style={{
                background: getEmployeeColor(name),
                borderRadius: 12,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: "bold" }}>{name}</div>
              <div>時給分: {byEmployee[name].wage}円</div>
              <div>ごはん代: {byEmployee[name].meal}円</div>
              <div style={{ fontWeight: "bold" }}>
                合計: {byEmployee[name].total}円
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          width: 62,
          height: 62,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          color: "#fff",
          fontSize: 30,
          fontWeight: "bold",
          boxShadow: "0 16px 32px rgba(37,99,235,0.35)",
          cursor: "pointer",
          zIndex: 50,
        }}
      >
        ＋
      </button>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 20,
            fontSize: 12,
            zIndex: 120,
            boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
          }}
        >
          {toast}
        </div>
      )}

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.42)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 999,
                background: "#d1d5db",
                margin: "0 auto 14px",
              }}
            />

            <h3 style={{ marginTop: 0, fontSize: 24 }}>シフト追加</h3>

            <div style={{ fontWeight: "bold", marginBottom: 8 }}>従業員</div>
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              {employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={newEmployee}
                onChange={(e) => setNewEmployee(e.target.value)}
                placeholder="新しい従業員名"
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  fontSize: 16,
                }}
              />
              <button
                onClick={handleAddEmployee}
                style={{
                  padding: "12px 14px",
                  border: "none",
                  borderRadius: 12,
                  background: "#10b981",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                追加
              </button>
            </div>

            <div style={{ fontWeight: "bold", marginBottom: 8 }}>日付</div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
                marginBottom: 12,
                fontWeight: "bold",
              }}
            >
              {displayDateJP(selectedDate)}
            </div>

            <div style={{ fontWeight: "bold", marginBottom: 8 }}>
              シフト種別
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                style={shiftButtonStyle("early")}
                onClick={() => handleShiftChange("early")}
              >
                早番 {shiftPreset.early.icon}
              </button>
              <button
                style={shiftButtonStyle("late")}
                onClick={() => handleShiftChange("late")}
              >
                遅番 {shiftPreset.late.icon}
              </button>
              <button
                style={shiftButtonStyle("full")}
                onClick={() => handleShiftChange("full")}
              >
                通し {shiftPreset.full.icon}
              </button>
            </div>

            <div style={{ fontSize: 18, marginBottom: 12 }}>
              開始: {currentPreset.start} / 終了: {currentPreset.end}
            </div>

            {shiftType === "full" && (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                  ごはん代 🍚
                </div>

                <label>
                  <input
                    type="radio"
                    checked={mealType === "none"}
                    onChange={() => {
                      setMealType("none");
                      setMealCost("");
                    }}
                  />
                  <span style={{ marginLeft: 6 }}>ごはんなし</span>
                </label>

                <label style={{ marginLeft: 14 }}>
                  <input
                    type="radio"
                    checked={mealType === "with"}
                    onChange={() => setMealType("with")}
                  />
                  <span style={{ marginLeft: 6 }}>ごはんあり</span>
                </label>

                {mealType === "with" && (
                  <input
                    type="number"
                    placeholder="金額"
                    value={mealCost}
                    onChange={(e) => setMealCost(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 10,
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      fontSize: 16,
                    }}
                  />
                )}
              </div>
            )}

            <div style={{ fontWeight: "bold", marginBottom: 8 }}>メモ</div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="作業内容など"
              style={{
                width: "100%",
                minHeight: 70,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                fontSize: 15,
                resize: "vertical",
                marginBottom: 12,
              }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  background: "#f3f4f6",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  fontWeight: "bold",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>

              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: "#2d6cdf",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                保存
              </button>
            </div>

            {message && (
              <div
                style={{
                  color: "#16a34a",
                  fontWeight: "bold",
                  marginTop: 10,
                }}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
