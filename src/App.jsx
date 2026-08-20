import { useState, useEffect, useRef, useMemo } from "react";
import {
  Users, Calculator, Clock, ShieldCheck, Receipt, Building2,
  Plus, Trash2, Printer, Save, AlertTriangle, Loader2, Download, Upload,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Storage (browser localStorage — persists per-device/per-browser)        */
/* ---------------------------------------------------------------------- */

const STORAGE_KEY = "pharmacy-salary-app-data";

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// "2026-04" -> "民國115年04月"
const rocLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const roc = parseInt(y, 10) - 1911;
  return `民國${roc}年${m}月`;
};

const money = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "NT$" + Math.round(n).toLocaleString("zh-TW");
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const DEFAULT_STORES = ["安禾", "嘉福", "敦富", "富元"];

const DEFAULT_BRACKETS = [
  { id: uid(), wage: 1500, laborEmp: 277, healthEmp: 458, laborEr: 972, healthEr: 1428, pensionEr: 90 },
];

const emptyState = () => ({
  stores: DEFAULT_STORES,
  employees: [],
  insuranceBrackets: DEFAULT_BRACKETS,
  payrollRecords: [],
  ptEmployees: [],
  ptRecords: [],
});

/* ---------------------------------------------------------------------- */
/* Computation                                                             */
/* ---------------------------------------------------------------------- */

function findBracket(brackets, wage) {
  if (wage === null || wage === undefined || wage === "") return null;
  return brackets.find((b) => Number(b.wage) === Number(wage)) || null;
}

function computeEmployeeDeductions(emp, brackets) {
  const bracket = findBracket(brackets, emp.insuredWage);
  const laborHealthSelfPay = bracket ? bracket.laborEmp + bracket.healthEmp : null;
  const dependentHealthEach = bracket ? bracket.healthEmp : null;
  const dependentHealthTotal =
    dependentHealthEach !== null ? dependentHealthEach * num(emp.dependents) : null;
  return { bracket, laborHealthSelfPay, dependentHealthEach, dependentHealthTotal };
}

function computePayrollRow(record, employees, brackets) {
  const emp = employees.find((e) => e.name === record.name) || null;
  if (!emp) {
    return { emp: null, missing: true };
  }
  const { laborHealthSelfPay, dependentHealthTotal, bracket } = computeEmployeeDeductions(emp, brackets);
  const otPay = (num(emp.otHourlyRate) / 60) * num(record.otMinutes);
  const leaveSettleAmount = num(emp.leaveSettleRate) * num(record.leaveDaysRemaining);
  const earnings =
    num(emp.baseSalary) +
    num(emp.dutyAllowance) +
    num(emp.licenseFee) +
    num(emp.positionAllowance) +
    num(emp.licenseMonthly) +
    num(record.salesBonus) +
    otPay +
    num(record.travelAllowance);
  const deductions = (laborHealthSelfPay || 0) + (dependentHealthTotal || 0);
  const netSalary = earnings - deductions;
  const cash = netSalary - num(emp.bankTransfer);
  return {
    emp,
    missing: false,
    bracket,
    otPay,
    leaveSettleAmount,
    laborHealthSelfPay,
    dependentHealthTotal,
    earnings,
    deductions,
    netSalary,
    cash,
  };
}

function computePtRow(record, ptEmployees) {
  const pt = ptEmployees.find((p) => p.name === record.name) || null;
  if (!pt) return { pt: null, missing: true };
  const weekdayPay = (num(record.weekdayMin) / 60) * num(pt.weekdayRate);
  const holidayPay = (num(record.holidayMin) / 60) * num(pt.holidayRate);
  const repWeekdayPay = (num(record.repWeekdayMin) / 60) * num(pt.repWeekdayRate);
  const repHolidayPay = (num(record.repHolidayMin) / 60) * num(pt.repHolidayRate);
  const total = weekdayPay + holidayPay + repWeekdayPay + repHolidayPay;
  return { pt, missing: false, weekdayPay, holidayPay, repWeekdayPay, repHolidayPay, total };
}

/* ---------------------------------------------------------------------- */
/* Small UI atoms                                                          */
/* ---------------------------------------------------------------------- */

const Field = ({ label, children, className = "" }) => (
  <label className={`flex flex-col gap-1 text-sm ${className}`}>
    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</span>
    {children}
  </label>
);

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const TextInput = (props) => <input {...props} className={`${inputCls} ${props.className || ""}`} />;
const SelectInput = (props) => (
  <select {...props} className={`${inputCls} ${props.className || ""}`}>
    {props.children}
  </select>
);

const IconBtn = ({ onClick, title, children, danger }) => (
  <button
    onClick={onClick}
    title={title}
    className={`inline-flex items-center justify-center rounded-md p-1.5 transition ${
      danger ? "text-rose-500 hover:bg-rose-50" : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
    }`}
  >
    {children}
  </button>
);

const PrimaryBtn = ({ onClick, children, className = "" }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 active:scale-[.98] ${className}`}
  >
    {children}
  </button>
);

const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-4">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
        {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

/* ---------------------------------------------------------------------- */
/* Main App                                                                */
/* ---------------------------------------------------------------------- */

const TABS = [
  { key: "employees", label: "員工資料", icon: Users },
  { key: "payroll", label: "正職薪資計算", icon: Calculator },
  { key: "ptEmployees", label: "兼職資料", icon: Clock },
  { key: "ptPayroll", label: "兼職時薪計算", icon: Clock },
  { key: "brackets", label: "勞健保級距", icon: ShieldCheck },
  { key: "payslip", label: "薪資單", icon: Receipt },
];

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("employees");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setData(loadData() || emptyState());
  }, []);

  useEffect(() => {
    if (!data) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveData(data);
      setSaveState(ok ? "saved" : "idle");
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  if (!data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-stone-50 text-stone-400">
        <Loader2 className="mr-2 animate-spin" size={18} /> 載入資料中…
      </div>
    );
  }

  const update = (patch) => setData((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-data-${todayMonth()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setData(parsed);
      } catch {
        alert("檔案格式錯誤，無法匯入。");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  };

  return (
    <div
      className="flex h-screen w-full flex-col bg-stone-50 text-stone-800"
      style={{ fontFamily: "'Noto Sans TC','Helvetica Neue',Arial,sans-serif" }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Building2 size={16} />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-stone-800">藥局薪資管理系統</h1>
            <p className="text-[11px] leading-tight text-stone-400">多店 · 正職 / 兼職薪資試算</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            {saveState === "saving" && (
              <>
                <Loader2 size={13} className="animate-spin" /> 儲存中…
              </>
            )}
            {saveState === "saved" && (
              <>
                <Save size={13} className="text-teal-600" /> 已儲存在本機瀏覽器
              </>
            )}
          </div>
          <button
            onClick={exportJson}
            title="匯出備份 (JSON)"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            <Download size={13} /> 匯出備份
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="匯入備份 (JSON)"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            <Upload size={13} /> 匯入備份
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importJson} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="no-print flex w-48 shrink-0 flex-col gap-0.5 border-r border-stone-200 bg-white p-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                tab === t.key ? "bg-teal-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {tab === "employees" && <EmployeesTab data={data} update={update} />}
          {tab === "payroll" && <PayrollTab data={data} update={update} />}
          {tab === "ptEmployees" && <PtEmployeesTab data={data} update={update} />}
          {tab === "ptPayroll" && <PtPayrollTab data={data} update={update} />}
          {tab === "brackets" && <BracketsTab data={data} update={update} />}
          {tab === "payslip" && <PayslipTab data={data} />}
        </main>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Employees Tab                                                           */
/* ---------------------------------------------------------------------- */

function EmployeesTab({ data, update }) {
  const addEmployee = () =>
    update((d) => ({
      employees: [
        ...d.employees,
        {
          id: uid(),
          store: d.stores[0] || "",
          name: "",
          hireDate: "",
          baseSalary: 0,
          dutyAllowance: 0,
          licenseFee: 0,
          positionAllowance: 0,
          licenseMonthly: 0,
          otHourlyRate: 0,
          leaveSettleRate: 0,
          insuredWage: d.insuranceBrackets[0]?.wage ?? "",
          dependents: 0,
          bankTransfer: 0,
        },
      ],
    }));

  const patchEmployee = (id, field, value) =>
    update((d) => ({ employees: d.employees.map((e) => (e.id === id ? { ...e, [field]: value } : e)) }));

  const removeEmployee = (id) => update((d) => ({ employees: d.employees.filter((e) => e.id !== id) }));

  return (
    <div>
      <SectionHeader
        icon={Users}
        title="員工資料"
        subtitle="每位正職員工的基本薪資結構，供正職薪資計算自動帶入"
        action={
          <PrimaryBtn onClick={addEmployee}>
            <Plus size={14} /> 新增員工
          </PrimaryBtn>
        }
      />

      {data.employees.length === 0 && <EmptyHint text="還沒有員工資料，點選「新增員工」開始建立。" />}

      <div className="flex flex-col gap-3">
        {data.employees.map((e) => {
          const { bracket, laborHealthSelfPay, dependentHealthTotal } = computeEmployeeDeductions(
            e,
            data.insuranceBrackets
          );
          return (
            <div key={e.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  <Field label="院所">
                    <SelectInput value={e.store} onChange={(ev) => patchEmployee(e.id, "store", ev.target.value)}>
                      {data.stores.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="姓名">
                    <TextInput value={e.name} onChange={(ev) => patchEmployee(e.id, "name", ev.target.value)} placeholder="姓名" />
                  </Field>
                  <Field label="到職日">
                    <TextInput type="date" value={e.hireDate} onChange={(ev) => patchEmployee(e.id, "hireDate", ev.target.value)} />
                  </Field>
                </div>
                <IconBtn danger title="刪除員工" onClick={() => removeEmployee(e.id)}>
                  <Trash2 size={15} />
                </IconBtn>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <Field label="本薪">
                  <TextInput type="number" value={e.baseSalary} onChange={(ev) => patchEmployee(e.id, "baseSalary", ev.target.value)} />
                </Field>
                <Field label="責任津貼">
                  <TextInput type="number" value={e.dutyAllowance} onChange={(ev) => patchEmployee(e.id, "dutyAllowance", ev.target.value)} />
                </Field>
                <Field label="執照費">
                  <TextInput type="number" value={e.licenseFee} onChange={(ev) => patchEmployee(e.id, "licenseFee", ev.target.value)} />
                </Field>
                <Field label="職務津貼">
                  <TextInput type="number" value={e.positionAllowance} onChange={(ev) => patchEmployee(e.id, "positionAllowance", ev.target.value)} />
                </Field>
                <Field label="執照月費">
                  <TextInput type="number" value={e.licenseMonthly} onChange={(ev) => patchEmployee(e.id, "licenseMonthly", ev.target.value)} />
                </Field>
                <Field label="加班時薪">
                  <TextInput type="number" value={e.otHourlyRate} onChange={(ev) => patchEmployee(e.id, "otHourlyRate", ev.target.value)} />
                </Field>
                <Field label="特休結算金額/天">
                  <TextInput type="number" value={e.leaveSettleRate} onChange={(ev) => patchEmployee(e.id, "leaveSettleRate", ev.target.value)} />
                </Field>
                <Field label="投保金額">
                  <SelectInput value={e.insuredWage} onChange={(ev) => patchEmployee(e.id, "insuredWage", ev.target.value)}>
                    <option value="">未設定</option>
                    {data.insuranceBrackets.map((b) => (
                      <option key={b.id} value={b.wage}>{b.wage}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="眷屬人數">
                  <TextInput type="number" value={e.dependents} onChange={(ev) => patchEmployee(e.id, "dependents", ev.target.value)} />
                </Field>
                <Field label="已匯入帳戶">
                  <TextInput type="number" value={e.bankTransfer} onChange={(ev) => patchEmployee(e.id, "bankTransfer", ev.target.value)} />
                </Field>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
                {bracket ? (
                  <>
                    <span>勞健保自付額：<b className="text-stone-800">{money(laborHealthSelfPay)}</b></span>
                    <span>員眷健保扣除：<b className="text-stone-800">{money(dependentHealthTotal)}</b></span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle size={13} /> 此投保金額尚未建立於「勞健保級距」表，請先新增對應級距
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <StoreManager data={data} update={update} />
    </div>
  );
}

function StoreManager({ data, update }) {
  const [newStore, setNewStore] = useState("");
  const addStore = () => {
    const v = newStore.trim();
    if (!v || data.stores.includes(v)) return;
    update((d) => ({ stores: [...d.stores, v] }));
    setNewStore("");
  };
  const removeStore = (s) => update((d) => ({ stores: d.stores.filter((x) => x !== s) }));

  return (
    <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">院所清單</p>
      <div className="flex flex-wrap items-center gap-2">
        {data.stores.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
            {s}
            <button onClick={() => removeStore(s)} className="text-stone-400 hover:text-rose-500">×</button>
          </span>
        ))}
        <TextInput
          value={newStore}
          onChange={(ev) => setNewStore(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && addStore()}
          placeholder="新增院所名稱"
          className="w-32"
        />
        <IconBtn title="新增院所" onClick={addStore}><Plus size={14} /></IconBtn>
      </div>
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div className="mb-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-400">
      {text}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Payroll (正職薪資計算) Tab                                              */
/* ---------------------------------------------------------------------- */

function PayrollTab({ data, update }) {
  const [month, setMonth] = useState(todayMonth());

  const monthRecords = data.payrollRecords.filter((r) => r.month === month);

  const addRecord = () => {
    if (data.employees.length === 0) return;
    update((d) => ({
      payrollRecords: [
        ...d.payrollRecords,
        {
          id: uid(),
          month,
          store: d.employees[0].store,
          name: d.employees[0].name,
          salesBonus: 0,
          otMinutes: 0,
          travelAllowance: 0,
          leaveDaysRemaining: 0,
        },
      ],
    }));
  };

  const patchRecord = (id, field, value) =>
    update((d) => ({ payrollRecords: d.payrollRecords.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }));

  const removeRecord = (id) => update((d) => ({ payrollRecords: d.payrollRecords.filter((r) => r.id !== id) }));

  const monthTotal = useMemo(
    () =>
      monthRecords.reduce((sum, r) => {
        const c = computePayrollRow(r, data.employees, data.insuranceBrackets);
        return sum + (c.missing ? 0 : c.netSalary);
      }, 0),
    [monthRecords, data.employees, data.insuranceBrackets]
  );

  return (
    <div>
      <SectionHeader
        icon={Calculator}
        title="正職薪資計算"
        subtitle="依「員工資料」自動帶入固定項目，僅需填寫每月異動數字"
        action={
          <div className="flex items-center gap-2">
            <TextInput type="month" value={month} onChange={(ev) => setMonth(ev.target.value)} />
            <PrimaryBtn onClick={addRecord}>
              <Plus size={14} /> 新增本月薪資列
            </PrimaryBtn>
          </div>
        }
      />
      <p className="mb-4 text-xs text-stone-400">{rocLabel(month)} · 共 {monthRecords.length} 筆 · 本月薪資合計 {money(monthTotal)}</p>

      {data.employees.length === 0 && <EmptyHint text="請先到「員工資料」建立至少一位員工。" />}
      {data.employees.length > 0 && monthRecords.length === 0 && <EmptyHint text="本月尚無薪資列，點選右上角新增。" />}

      <div className="flex flex-col gap-3">
        {monthRecords.map((r) => {
          const c = computePayrollRow(r, data.employees, data.insuranceBrackets);
          return (
            <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="院所">
                    <SelectInput value={r.store} onChange={(ev) => patchRecord(r.id, "store", ev.target.value)}>
                      {data.stores.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="姓名">
                    <SelectInput value={r.name} onChange={(ev) => patchRecord(r.id, "name", ev.target.value)}>
                      {data.employees.map((e) => (
                        <option key={e.id} value={e.name}>{e.name || "(未命名)"}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <IconBtn danger title="刪除此列" onClick={() => removeRecord(r.id)}>
                  <Trash2 size={15} />
                </IconBtn>
              </div>

              {c.missing ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={13} /> 找不到符合姓名的員工資料
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="銷售獎金">
                      <TextInput type="number" value={r.salesBonus} onChange={(ev) => patchRecord(r.id, "salesBonus", ev.target.value)} />
                    </Field>
                    <Field label="加班時數(分)">
                      <TextInput type="number" value={r.otMinutes} onChange={(ev) => patchRecord(r.id, "otMinutes", ev.target.value)} />
                    </Field>
                    <Field label="車馬費">
                      <TextInput type="number" value={r.travelAllowance} onChange={(ev) => patchRecord(r.id, "travelAllowance", ev.target.value)} />
                    </Field>
                    <Field label="特休剩餘天數">
                      <TextInput type="number" value={r.leaveDaysRemaining} onChange={(ev) => patchRecord(r.id, "leaveDaysRemaining", ev.target.value)} />
                    </Field>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-600 sm:grid-cols-4">
                    <span>本薪 {money(c.emp.baseSalary)}</span>
                    <span>責任津貼 {money(c.emp.dutyAllowance)}</span>
                    <span>執照費 {money(c.emp.licenseFee)}</span>
                    <span>職務津貼 {money(c.emp.positionAllowance)}</span>
                    <span>執照月費 {money(c.emp.licenseMonthly)}</span>
                    <span>加班費 {money(c.otPay)}</span>
                    <span>年度特休結算 {money(c.leaveSettleAmount)}</span>
                    <span>勞健保自付額 {money(c.laborHealthSelfPay)}</span>
                    <span>員眷健保扣除 {money(c.dependentHealthTotal)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 border-t border-stone-100 pt-2.5 text-sm">
                    <span className="text-stone-500">本月薪資 <b className="text-stone-900">{money(c.netSalary)}</b></span>
                    <span className="text-stone-500">已匯入帳戶 <b className="text-stone-900">{money(c.emp.bankTransfer)}</b></span>
                    <span className="text-stone-500">現金 <b className="text-teal-700">{money(c.cash)}</b></span>
                  </div>
                  {!c.bracket && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle size={12} /> 投保金額未對應到級距表，勞健保自付額無法計算
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Part-time employees (兼職資料) Tab                                      */
/* ---------------------------------------------------------------------- */

function PtEmployeesTab({ data, update }) {
  const addPt = () =>
    update((d) => ({
      ptEmployees: [
        ...d.ptEmployees,
        { id: uid(), store: d.stores[0] || "", name: "", weekdayRate: 0, holidayRate: 0, repWeekdayRate: 0, repHolidayRate: 0, note: "" },
      ],
    }));
  const patchPt = (id, field, value) =>
    update((d) => ({ ptEmployees: d.ptEmployees.map((p) => (p.id === id ? { ...p, [field]: value } : p)) }));
  const removePt = (id) => update((d) => ({ ptEmployees: d.ptEmployees.filter((p) => p.id !== id) }));

  return (
    <div>
      <SectionHeader
        icon={Clock}
        title="兼職資料"
        subtitle="兼職人員的各類時薪，供兼職時薪計算自動帶入"
        action={
          <PrimaryBtn onClick={addPt}>
            <Plus size={14} /> 新增兼職人員
          </PrimaryBtn>
        }
      />
      {data.ptEmployees.length === 0 && <EmptyHint text="還沒有兼職人員資料，點選「新增兼職人員」開始建立。" />}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2.5">投保院所</th>
              <th className="px-3 py-2.5">姓名</th>
              <th className="px-3 py-2.5">平日時薪</th>
              <th className="px-3 py-2.5">假日時薪</th>
              <th className="px-3 py-2.5">報備平日時薪</th>
              <th className="px-3 py-2.5">報備假日時薪</th>
              <th className="px-3 py-2.5">備註</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.ptEmployees.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2">
                  <SelectInput value={p.store} onChange={(ev) => patchPt(p.id, "store", ev.target.value)}>
                    {data.stores.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SelectInput>
                </td>
                <td className="px-3 py-2"><TextInput value={p.name} onChange={(ev) => patchPt(p.id, "name", ev.target.value)} className="w-24" /></td>
                <td className="px-3 py-2"><TextInput type="number" value={p.weekdayRate} onChange={(ev) => patchPt(p.id, "weekdayRate", ev.target.value)} className="w-20" /></td>
                <td className="px-3 py-2"><TextInput type="number" value={p.holidayRate} onChange={(ev) => patchPt(p.id, "holidayRate", ev.target.value)} className="w-20" /></td>
                <td className="px-3 py-2"><TextInput type="number" value={p.repWeekdayRate} onChange={(ev) => patchPt(p.id, "repWeekdayRate", ev.target.value)} className="w-20" /></td>
                <td className="px-3 py-2"><TextInput type="number" value={p.repHolidayRate} onChange={(ev) => patchPt(p.id, "repHolidayRate", ev.target.value)} className="w-20" /></td>
                <td className="px-3 py-2"><TextInput value={p.note} onChange={(ev) => patchPt(p.id, "note", ev.target.value)} className="w-28" /></td>
                <td className="px-3 py-2"><IconBtn danger title="刪除" onClick={() => removePt(p.id)}><Trash2 size={14} /></IconBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Part-time payroll (兼職時薪計算) Tab                                    */
/* ---------------------------------------------------------------------- */

function PtPayrollTab({ data, update }) {
  const [month, setMonth] = useState(todayMonth());
  const monthRecords = data.ptRecords.filter((r) => r.month === month);

  const addRecord = () => {
    if (data.ptEmployees.length === 0) return;
    update((d) => ({
      ptRecords: [
        ...d.ptRecords,
        {
          id: uid(),
          month,
          store: d.ptEmployees[0].store,
          name: d.ptEmployees[0].name,
          weekdayMin: 0,
          holidayMin: 0,
          repWeekdayMin: 0,
          repHolidayMin: 0,
        },
      ],
    }));
  };
  const patchRecord = (id, field, value) =>
    update((d) => ({ ptRecords: d.ptRecords.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }));
  const removeRecord = (id) => update((d) => ({ ptRecords: d.ptRecords.filter((r) => r.id !== id) }));

  const monthTotal = useMemo(
    () => monthRecords.reduce((sum, r) => sum + (computePtRow(r, data.ptEmployees).total || 0), 0),
    [monthRecords, data.ptEmployees]
  );

  return (
    <div>
      <SectionHeader
        icon={Clock}
        title="兼職時薪計算"
        subtitle="以分鐘輸入每月工時，自動依「兼職資料」時薪換算薪資"
        action={
          <div className="flex items-center gap-2">
            <TextInput type="month" value={month} onChange={(ev) => setMonth(ev.target.value)} />
            <PrimaryBtn onClick={addRecord}>
              <Plus size={14} /> 新增本月工時列
            </PrimaryBtn>
          </div>
        }
      />
      <p className="mb-4 text-xs text-stone-400">{rocLabel(month)} · 共 {monthRecords.length} 筆 · 本月合計 {money(monthTotal)}</p>

      {data.ptEmployees.length === 0 && <EmptyHint text="請先到「兼職資料」建立至少一位兼職人員。" />}
      {data.ptEmployees.length > 0 && monthRecords.length === 0 && <EmptyHint text="本月尚無工時紀錄，點選右上角新增。" />}

      <div className="flex flex-col gap-3">
        {monthRecords.map((r) => {
          const c = computePtRow(r, data.ptEmployees);
          return (
            <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="投保院所">
                    <SelectInput value={r.store} onChange={(ev) => patchRecord(r.id, "store", ev.target.value)}>
                      {data.stores.map((s) => <option key={s} value={s}>{s}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="姓名">
                    <SelectInput value={r.name} onChange={(ev) => patchRecord(r.id, "name", ev.target.value)}>
                      {data.ptEmployees.map((p) => <option key={p.id} value={p.name}>{p.name || "(未命名)"}</option>)}
                    </SelectInput>
                  </Field>
                </div>
                <IconBtn danger title="刪除此列" onClick={() => removeRecord(r.id)}>
                  <Trash2 size={15} />
                </IconBtn>
              </div>

              {c.missing ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={13} /> 找不到符合姓名的兼職資料
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="平日時數(分)">
                      <TextInput type="number" value={r.weekdayMin} onChange={(ev) => patchRecord(r.id, "weekdayMin", ev.target.value)} />
                    </Field>
                    <Field label="假日時數(分)">
                      <TextInput type="number" value={r.holidayMin} onChange={(ev) => patchRecord(r.id, "holidayMin", ev.target.value)} />
                    </Field>
                    <Field label="報備平日時數(分)">
                      <TextInput type="number" value={r.repWeekdayMin} onChange={(ev) => patchRecord(r.id, "repWeekdayMin", ev.target.value)} />
                    </Field>
                    <Field label="報備假日時數(分)">
                      <TextInput type="number" value={r.repHolidayMin} onChange={(ev) => patchRecord(r.id, "repHolidayMin", ev.target.value)} />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
                    <span>平日薪資 {money(c.weekdayPay)}</span>
                    <span>假日薪資 {money(c.holidayPay)}</span>
                    <span>報備平日薪資 {money(c.repWeekdayPay)}</span>
                    <span>報備假日薪資 {money(c.repHolidayPay)}</span>
                  </div>
                  <div className="mt-2 border-t border-stone-100 pt-2.5 text-sm text-stone-500">
                    總額 <b className="text-teal-700">{money(c.total)}</b>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Insurance brackets (勞健保級距) Tab                                     */
/* ---------------------------------------------------------------------- */

function BracketsTab({ data, update }) {
  const addBracket = () =>
    update((d) => ({
      insuranceBrackets: [
        ...d.insuranceBrackets,
        { id: uid(), wage: 0, laborEmp: 0, healthEmp: 0, laborEr: 0, healthEr: 0, pensionEr: 0 },
      ],
    }));
  const patchBracket = (id, field, value) =>
    update((d) => ({
      insuranceBrackets: d.insuranceBrackets.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    }));
  const removeBracket = (id) => update((d) => ({ insuranceBrackets: d.insuranceBrackets.filter((b) => b.id !== id) }));

  const sorted = [...data.insuranceBrackets].sort((a, b) => num(a.wage) - num(b.wage));

  return (
    <div>
      <SectionHeader
        icon={ShieldCheck}
        title="勞健保級距"
        subtitle="投保薪資對應的勞保／健保自付與雇主負擔金額，請依最新公告級距表維護"
        action={
          <PrimaryBtn onClick={addBracket}>
            <Plus size={14} /> 新增級距
          </PrimaryBtn>
        }
      />
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        本表僅預先帶入原始檔案中的一筆級距，其餘級距請依勞保局／衛福部最新公告的「勞工保險及就業保險投保薪資分級表」與「全民健康保險保險費負擔金額表」自行輸入，避免試算金額有誤。
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2.5">投保薪資</th>
              <th className="px-3 py-2.5" colSpan={2}>員工自付額（勞保／健保）</th>
              <th className="px-3 py-2.5">自付合計</th>
              <th className="px-3 py-2.5" colSpan={3}>雇主負擔（勞保／健保／勞退）</th>
              <th className="px-3 py-2.5">雇主合計</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const empTotal = num(b.laborEmp) + num(b.healthEmp);
              const erTotal = num(b.laborEr) + num(b.healthEr) + num(b.pensionEr);
              return (
                <tr key={b.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2"><TextInput type="number" value={b.wage} onChange={(ev) => patchBracket(b.id, "wage", ev.target.value)} className="w-24" /></td>
                  <td className="px-3 py-2"><TextInput type="number" value={b.laborEmp} onChange={(ev) => patchBracket(b.id, "laborEmp", ev.target.value)} className="w-20" /></td>
                  <td className="px-3 py-2"><TextInput type="number" value={b.healthEmp} onChange={(ev) => patchBracket(b.id, "healthEmp", ev.target.value)} className="w-20" /></td>
                  <td className="px-3 py-2 font-medium text-stone-700">{money(empTotal)}</td>
                  <td className="px-3 py-2"><TextInput type="number" value={b.laborEr} onChange={(ev) => patchBracket(b.id, "laborEr", ev.target.value)} className="w-20" /></td>
                  <td className="px-3 py-2"><TextInput type="number" value={b.healthEr} onChange={(ev) => patchBracket(b.id, "healthEr", ev.target.value)} className="w-20" /></td>
                  <td className="px-3 py-2"><TextInput type="number" value={b.pensionEr} onChange={(ev) => patchBracket(b.id, "pensionEr", ev.target.value)} className="w-20" /></td>
                  <td className="px-3 py-2 font-medium text-stone-700">{money(erTotal)}</td>
                  <td className="px-3 py-2"><IconBtn danger title="刪除" onClick={() => removeBracket(b.id)}><Trash2 size={14} /></IconBtn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Payslip (薪資單) Tab                                                    */
/* ---------------------------------------------------------------------- */

function PayslipTab({ data }) {
  const [kind, setKind] = useState("fulltime");
  const [month, setMonth] = useState(todayMonth());

  const fullSlips = data.payrollRecords
    .filter((r) => r.month === month)
    .map((r) => ({ r, c: computePayrollRow(r, data.employees, data.insuranceBrackets) }))
    .filter((x) => !x.c.missing);

  const ptSlips = data.ptRecords
    .filter((r) => r.month === month)
    .map((r) => ({ r, c: computePtRow(r, data.ptEmployees) }))
    .filter((x) => !x.c.missing);

  return (
    <div>
      <SectionHeader
        icon={Receipt}
        title="薪資單"
        subtitle="產生可列印的個人薪資單"
        action={
          <div className="no-print flex items-center gap-2">
            <SelectInput value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="fulltime">正職</option>
              <option value="parttime">兼職</option>
            </SelectInput>
            <TextInput type="month" value={month} onChange={(ev) => setMonth(ev.target.value)} />
            <PrimaryBtn onClick={() => window.print()}>
              <Printer size={14} /> 列印本頁
            </PrimaryBtn>
          </div>
        }
      />

      {kind === "fulltime" && fullSlips.length === 0 && <EmptyHint text="本月尚無正職薪資資料可產生薪資單。" />}
      {kind === "parttime" && ptSlips.length === 0 && <EmptyHint text="本月尚無兼職薪資資料可產生薪資單。" />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {kind === "fulltime" &&
          fullSlips.map(({ r, c }) => <FullTimeSlip key={r.id} record={r} c={c} />)}
        {kind === "parttime" &&
          ptSlips.map(({ r, c }) => <PartTimeSlip key={r.id} record={r} c={c} />)}
      </div>
    </div>
  );
}

function SlipRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-dotted border-stone-200 py-1.5 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-800">{money(value)}</span>
    </div>
  );
}

function FullTimeSlip({ record, c }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-stone-800">{c.emp.name} 薪資單</h3>
          <p className="text-xs text-stone-400">{record.store} · {rocLabel(record.month)}</p>
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">正職</span>
      </div>

      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">加項</p>
      <SlipRow label="本薪" value={c.emp.baseSalary} />
      <SlipRow label="責任津貼" value={c.emp.dutyAllowance} />
      <SlipRow label="執照費" value={c.emp.licenseFee} />
      <SlipRow label="職務津貼" value={c.emp.positionAllowance} />
      <SlipRow label="執照月費" value={c.emp.licenseMonthly} />
      <SlipRow label="加班費" value={c.otPay} />
      <SlipRow label="銷售獎金" value={record.salesBonus} />
      <SlipRow label="車馬費" value={record.travelAllowance} />
      <SlipRow label="年度特休結算" value={c.leaveSettleAmount} />

      <p className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-stone-400">減項</p>
      <SlipRow label="勞健保自付額" value={c.laborHealthSelfPay} />
      <SlipRow label="員眷健保扣除" value={c.dependentHealthTotal} />

      <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5">
        <span className="text-sm text-stone-600">本月薪資 {money(c.netSalary)} − 已匯入 {money(c.emp.bankTransfer)}</span>
        <span className="text-base font-semibold text-teal-700">現金 {money(c.cash)}</span>
      </div>
      <p className="mt-2 text-[11px] text-stone-400">＊年度特休結算金額列於加項供參考，不計入本月薪資／現金合計，比照原始範本邏輯。</p>
    </div>
  );
}

function PartTimeSlip({ record, c }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-stone-800">{c.pt.name} 薪資單</h3>
          <p className="text-xs text-stone-400">{record.store} · {rocLabel(record.month)}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">兼職</span>
      </div>

      <SlipRow label={`平日時數(分) ${record.weekdayMin}`} value={c.weekdayPay} />
      <SlipRow label={`假日時數(分) ${record.holidayMin}`} value={c.holidayPay} />
      <SlipRow label={`報備平日時數(分) ${record.repWeekdayMin}`} value={c.repWeekdayPay} />
      <SlipRow label={`報備假日時數(分) ${record.repHolidayMin}`} value={c.repHolidayPay} />

      <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5">
        <span className="text-sm text-stone-600">總額</span>
        <span className="text-base font-semibold text-teal-700">{money(c.total)}</span>
      </div>
    </div>
  );
}
