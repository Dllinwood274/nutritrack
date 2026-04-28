import { useState, useEffect, useRef } from "react";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

// --- Defaults & Helpers ---
const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 225, fat: 67 };
const MEAL_TIMES = ["Breakfast", "Morning Snack", "Lunch", "Afternoon Snack", "Dinner", "Evening Snack"];

const MACRO_COLORS = {
  calories: "#FF6B35",
  protein: "#4ECDC4",
  carbs: "#FFE66D",
  fat: "#A8DADC",
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function Ring({ value, max, color, size = 80, stroke = 8, label, sub }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = clamp(value / (max || 1), 0, 1);
  const dash = pct * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div style={{ textAlign: "center", marginTop: -size / 2 - 8, height: size, display: "flex", flexDirection: "column", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: size > 70 ? 15 : 12, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      </div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, color, unit = "g" }) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100);
  const over = value > max;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color: over ? "#FF6B6B" : "#fff" }}>
          {value}{unit} / {max}{unit}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 3,
          background: over ? "#FF6B6B" : color,
          boxShadow: `0 0 8px ${over ? "#FF6B6B" : color}88`,
          transition: "width 0.6s cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
      background: `${color}22`, color, border: `1px solid ${color}44`
    }}>{children}</span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: 20, backdropFilter: "blur(8px)", ...style
    }}>{children}</div>
  );
}

// --- localStorage helpers ---
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}


// --- Shared Date Picker ---
function DatePicker({ value, onChange, todayKey, label = "Logging for" }) {
  // Build list of last 30 days for dropdown
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });
  const isToday = value === todayKey;
  const displayLabel = isToday
    ? "Today"
    : new Date(value + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      borderRadius: 12, background: isToday ? "rgba(78,205,196,0.08)" : "rgba(255,230,109,0.08)",
      border: `1px solid ${isToday ? "rgba(78,205,196,0.25)" : "rgba(255,230,109,0.25)"}`,
      marginBottom: 16
    }}>
      <span style={{ fontSize: 16 }}>{isToday ? "📅" : "⏪"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? "#4ECDC4" : "#FFE66D" }}>{displayLabel}</div>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 12,
          outline: "none", cursor: "pointer"
        }}
      >
        {days.map((d, i) => (
          <option key={d} value={d}>
            {i === 0 ? "Today" : new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Main App ---
export default function MacroTracker() {
  const [tab, setTab] = useState("dashboard");
  const [goals, setGoals] = useState(() => load("nt_goals", DEFAULT_GOALS));
  const [meals, setMeals] = useState(() => load("nt_meals", []));
  const [addForm, setAddForm] = useState({ name: "", mealTime: "Breakfast", calories: "", protein: "", carbs: "", fat: "" });
  const [goalForm, setGoalForm] = useState(() => load("nt_goals", DEFAULT_GOALS));
  const [bodyProfile, setBodyProfile] = useState(() => load("nt_profile", { age: "", sex: "male", heightFt: "", heightIn: "", weight: "", activityLevel: "moderate", fitnessGoal: "lean_loss" }));
  const [profileSaved, setProfileSaved] = useState(() => load("nt_profile_saved", false));
  const [computedMacros, setComputedMacros] = useState(() => load("nt_computed_macros", null));
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mealIdea, setMealIdea] = useState(null);
  const [mealIdeaLoading, setMealIdeaLoading] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [scanMode, setScanMode] = useState(false);
  const [weightLog, setWeightLog] = useState(() => load("nt_weight_log", []));
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState(() => load("nt_weight_unit", "lbs"));
  const [weightGoal, setWeightGoal] = useState(() => load("nt_weight_goal", ""));
  const [workoutLog, setWorkoutLog] = useState(() => load("nt_workout_log", {}));
  const [creatineLog, setCreatineLog] = useState(() => load("nt_creatine_log", {}));
  const [historyDate, setHistoryDate] = useState(null);
  const [avgPeriod, setAvgPeriod] = useState(7); // days for averages: 7, 14, 30, 90
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const todayKey = new Date().toISOString().split("T")[0];
  const chatEndRef = useRef(null);

  // ── Persist all data to localStorage whenever it changes ──────────────────
  useEffect(() => { localStorage.setItem("nt_goals", JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem("nt_meals", JSON.stringify(meals)); }, [meals]);
  useEffect(() => { localStorage.setItem("nt_profile", JSON.stringify(bodyProfile)); }, [bodyProfile]);
  useEffect(() => { localStorage.setItem("nt_profile_saved", JSON.stringify(profileSaved)); }, [profileSaved]);
  useEffect(() => { localStorage.setItem("nt_computed_macros", JSON.stringify(computedMacros)); }, [computedMacros]);
  useEffect(() => { localStorage.setItem("nt_weight_log", JSON.stringify(weightLog)); }, [weightLog]);
  useEffect(() => { localStorage.setItem("nt_weight_unit", JSON.stringify(weightUnit)); }, [weightUnit]);
  useEffect(() => { localStorage.setItem("nt_weight_goal", JSON.stringify(weightGoal)); }, [weightGoal]);
  useEffect(() => { localStorage.setItem("nt_workout_log", JSON.stringify(workoutLog)); }, [workoutLog]);
  useEffect(() => { localStorage.setItem("nt_creatine_log", JSON.stringify(creatineLog)); }, [creatineLog]);

  // Only count today's meals in totals (all meals are saved permanently)
  const todayMeals = meals.filter(m => (m.date || "legacy") === todayKey);
  const totals = todayMeals.reduce(
    (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const remaining = {
    calories: goals.calories - totals.calories,
    protein: goals.protein - totals.protein,
    carbs: goals.carbs - totals.carbs,
    fat: goals.fat - totals.fat,
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiChat]);

  function addMeal(e) {
    e.preventDefault();
    if (!addForm.name || !addForm.calories) return;
    const newMeal = {
      id: Date.now(),
      date: logDate,
      name: addForm.name,
      mealTime: addForm.mealTime,
      calories: Number(addForm.calories) || 0,
      protein: Number(addForm.protein) || 0,
      carbs: Number(addForm.carbs) || 0,
      fat: Number(addForm.fat) || 0,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    const updatedMeals = [...meals, newMeal];
    setMeals(updatedMeals);
    setAddForm({ name: "", mealTime: addForm.mealTime, calories: "", protein: "", carbs: "", fat: "" });
    if (logDate === todayKey) {
      const todaysUpdated = updatedMeals.filter(m => (m.date || "legacy") === todayKey);
      fetchSmartSuggestions(todaysUpdated, goals);
      setTab("ideas");
    }
  }

  async function fetchSmartSuggestions(currentMeals, currentGoals) {
    setSmartLoading(true);
    setSmartSuggestions(null);
    const eaten = currentMeals.reduce(
      (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const rem = {
      calories: currentGoals.calories - eaten.calories,
      protein: currentGoals.protein - eaten.protein,
      carbs: currentGoals.carbs - eaten.carbs,
      fat: currentGoals.fat - eaten.fat,
    };

    // Figure out which meals are still upcoming
    const mealOrder = ["Breakfast", "Morning Snack", "Lunch", "Afternoon Snack", "Dinner", "Evening Snack"];
    const loggedTimes = currentMeals.map(m => m.mealTime);
    const lastLogged = mealOrder.filter(t => loggedTimes.includes(t)).pop();
    const lastIdx = lastLogged ? mealOrder.indexOf(lastLogged) : -1;
    const upcoming = mealOrder.slice(lastIdx + 1).filter(t => !t.toLowerCase().includes("snack") || rem.calories > 200);

    const prompt = `
You are an expert nutritionist and chef. A user has logged these meals today:
${currentMeals.map(m => `- ${m.mealTime}: ${m.name} (${m.calories}kcal, P:${m.protein}g, C:${m.carbs}g, F:${m.fat}g)`).join("\n")}

Their daily goals: ${currentGoals.calories}kcal, P:${currentGoals.protein}g, C:${currentGoals.carbs}g, F:${currentGoals.fat}g
Remaining for today: ${rem.calories}kcal, P:${rem.protein}g, C:${rem.carbs}g, F:${rem.fat}g
Upcoming meal slots: ${upcoming.join(", ") || "Evening Snack"}

Generate smart meal suggestions to fill the remaining macros perfectly across the upcoming meal slots.
Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "one sentence about the day so far and what's needed",
  "suggestions": [
    {
      "mealTime": "Lunch",
      "name": "Meal name",
      "description": "Brief appetizing description",
      "portionNote": "Specific portion size e.g. '200g chicken, 1 cup rice'",
      "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
      "ingredients": ["item with amount", ...],
      "prepSteps": ["step 1", "step 2", "step 3"],
      "prepTime": "X mins",
      "balanceReason": "Why this meal fits your remaining macros"
    }
  ]
}
Provide 2-3 suggestions covering the remaining meal slots. Make sure the combined macros of all suggestions come close to the remaining totals. Portions should be specific and realistic.
    `.trim();

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      setSmartSuggestions(JSON.parse(clean));
    } catch {
      setSmartSuggestions({ summary: "Could not load suggestions. Try refreshing.", suggestions: [] });
    }
    setSmartLoading(false);
  }

  function removeMeal(id) { setMeals(prev => prev.filter(m => m.id !== id)); }

  function saveGoals(e) {
    e.preventDefault();
    const saved = { ...goalForm };
    setGoals(saved);
    // Keep goalForm in sync with what was actually saved
    setGoalForm(saved);
    localStorage.setItem("nt_goals", JSON.stringify(saved));
    setTab("dashboard");
  }

  // ── Macro Auto-Calculator (Mifflin-St Jeor + goal split) ──────────────────
  function calculateMacrosFromProfile(profile) {
    const { age, sex, heightFt, heightIn, weight, activityLevel, fitnessGoal } = profile;
    const ageN = parseFloat(age), weightLbs = parseFloat(weight);
    const totalInches = (parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0);
    if (!ageN || !weightLbs || !totalInches) return null;

    const weightKg = weightLbs * 0.453592;
    const heightCm = totalInches * 2.54;

    // BMR via Mifflin-St Jeor
    const bmr = sex === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageN - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageN + 5;

    const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * (activityMultipliers[activityLevel] || 1.55));

    // Calorie target by goal
    const goalCalories = {
      lean_loss:    Math.round(tdee * 0.80),  // -20% deficit, high protein
      fat_loss:     Math.round(tdee * 0.75),  // -25% deficit
      maintenance:  tdee,
      muscle_gain:  Math.round(tdee * 1.10),  // +10% surplus
      bulk:         Math.round(tdee * 1.20),  // +20% surplus
    }[fitnessGoal] || tdee;

    // Macro splits by goal (protein first, then fat, fill rest with carbs)
    const proteinPerLb = { lean_loss: 1.1, fat_loss: 1.0, maintenance: 0.8, muscle_gain: 1.0, bulk: 0.9 }[fitnessGoal] || 0.9;
    const protein = Math.round(weightLbs * proteinPerLb);
    const fatPct  = { lean_loss: 0.25, fat_loss: 0.25, maintenance: 0.30, muscle_gain: 0.25, bulk: 0.25 }[fitnessGoal] || 0.28;
    const fat     = Math.round((goalCalories * fatPct) / 9);
    const carbs   = Math.round((goalCalories - protein * 4 - fat * 9) / 4);

    return { calories: goalCalories, protein, carbs: Math.max(carbs, 20), fat, tdee };
  }

  function applyComputedMacros(profile) {
    const result = calculateMacrosFromProfile(profile);
    if (!result) return;
    const saved = { calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat };
    setComputedMacros(result);
    setGoals(saved);
    setGoalForm(saved);
    setProfileSaved(true);
    // Hard-write immediately so nothing can overwrite it
    localStorage.setItem("nt_goals", JSON.stringify(saved));
    localStorage.setItem("nt_computed_macros", JSON.stringify(result));
    localStorage.setItem("nt_profile_saved", JSON.stringify(true));
  }

  // ── Barcode Lookup via Open Food Facts ────────────────────────────────────
  async function lookupBarcode(code) {
    if (!code.trim()) return;
    setBarcodeLoading(true);
    setBarcodeError("");
    setBarcodeResult(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setBarcodeError("Product not found. Try another barcode or enter macros manually.");
        setBarcodeLoading(false);
        return;
      }
      const p = data.product;
      const n = p.nutriments || {};
      const per100 = (key) => Math.round(n[key + "_100g"] || n[key] || 0);
      setBarcodeResult({
        name: p.product_name || p.generic_name || "Unknown Product",
        brand: p.brands || "",
        servingSize: p.serving_size || "100g",
        calories: per100("energy-kcal"),
        protein: per100("proteins"),
        carbs: per100("carbohydrates"),
        fat: per100("fat"),
        image: p.image_small_url || null,
      });
    } catch {
      setBarcodeError("Network error. Check your connection and try again.");
    }
    setBarcodeLoading(false);
  }

  function applyBarcodeToForm(result) {
    setAddForm(prev => ({
      ...prev,
      name: result.name + (result.brand ? ` (${result.brand})` : ""),
      calories: String(result.calories),
      protein: String(result.protein),
      carbs: String(result.carbs),
      fat: String(result.fat),
    }));
    setBarcodeResult(null);
    setBarcodeInput("");
    setScanMode(false);
  }

  async function sendAiMessage() {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiChat(prev => [...prev, { role: "user", content: userMsg }]);
    setAiLoading(true);

    const context = `
You are a friendly, expert nutritionist assistant inside a macro tracking app.
Current goals: ${goals.calories} kcal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat.
Consumed today: ${totals.calories} kcal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat.
Remaining: ${remaining.calories} kcal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.
Today's meals: ${todayMeals.map(m => `${m.mealTime} - ${m.name} (${m.calories}kcal, P:${m.protein}g, C:${m.carbs}g, F:${m.fat}g)`).join("; ") || "None logged yet"}.
Give short, practical, friendly advice. Use emojis sparingly. Format with line breaks for readability.
    `.trim();

    try {
      const messages = [
        ...aiChat.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg }
      ];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, system: context, messages })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "Sorry, I couldn't respond right now.";
      setAiChat(prev => [...prev, { role: "assistant", content: text }]);
    } catch {
      setAiChat(prev => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setAiLoading(false);
  }

  async function getMealIdea() {
    setMealIdeaLoading(true);
    setMealIdea(null);
    const prompt = `
You are a creative chef and nutritionist. Based on these remaining macros for today, suggest ONE specific meal idea with prep instructions.
Remaining: ${remaining.calories} kcal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.
Today's meals already eaten: ${todayMeals.map(m => m.name).join(", ") || "nothing yet"}.
Respond ONLY with a JSON object (no markdown, no backticks) with these fields:
{ "name": "Meal Name", "description": "2-sentence description", "prepTime": "X mins", "cookTime": "X mins", "difficulty": "Easy|Medium|Hard", "ingredients": ["item 1","item 2",...], "steps": ["step 1","step 2",...], "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }, "tip": "one pro tip" }
    `.trim();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      setMealIdea(JSON.parse(clean));
    } catch { setMealIdea({ name: "Error", description: "Could not fetch meal idea.", prepTime: "-", cookTime: "-", difficulty: "Easy", ingredients: [], steps: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, tip: "" }); }
    setMealIdeaLoading(false);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13,
    outline: "none", width: "100%", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif"
  };
  const labelStyle = { fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "block" };
  const tabs = [
    { id: "dashboard", icon: "◉", label: "Today" },
    { id: "log", icon: "＋", label: "Log" },
    { id: "history", icon: "📅", label: "History" },
    { id: "weight", icon: "⬡", label: "Weight" },
    { id: "workout", icon: "⚡", label: "Workout" },
    { id: "ideas", icon: "✦", label: "Meals" },
    { id: "coach", icon: "◈", label: "Coach" },
    { id: "goals", icon: "◎", label: "Goals" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0C0C14",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(78,205,196,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 85% 80%, rgba(255,107,53,0.08) 0%, transparent 60%)",
      fontFamily: "'DM Sans', sans-serif", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 480, padding: "24px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4ECDC4", letterSpacing: 3, textTransform: "uppercase" }}>macro</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>NutriTrack</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#FF6B35", marginTop: 2 }}>{totals.calories} / {goals.calories} kcal</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
              background: tab === t.id ? "rgba(255,255,255,0.1)" : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.4)",
              fontSize: tab === t.id ? 10 : 9, fontWeight: 600, transition: "all 0.2s",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              boxShadow: tab === t.id ? "0 1px 8px rgba(0,0,0,0.3)" : "none"
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* --- DASHBOARD --- */}
        {tab === "dashboard" && (
          <div style={{ paddingBottom: 40 }}>
            {/* Calorie ring + macros */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>Daily Goal</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{goals.calories}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>kcal</span></div>
                </div>
                <Ring value={totals.calories} max={goals.calories} color={MACRO_COLORS.calories} size={90} stroke={9} label="eaten" sub={`${remaining.calories > 0 ? remaining.calories + " left" : "over by " + Math.abs(remaining.calories)}`} />
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "space-around", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {[["protein", "P"], ["carbs", "C"], ["fat", "F"]].map(([k, l]) => (
                  <Ring key={k} value={totals[k]} max={goals[k]} color={MACRO_COLORS[k]} size={68} stroke={7} label={l} />
                ))}
              </div>
            </Card>

            {/* Bars */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Macro Breakdown</div>
              {[["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]].map(([l, k, u]) => (
                <Bar key={k} label={l} value={totals[k]} max={goals[k]} color={MACRO_COLORS[k]} unit={u} />
              ))}
            </Card>

            {/* Portion suggestion */}
            <Card style={{ marginBottom: 16, borderColor: "rgba(78,205,196,0.2)" }}>
              <div style={{ fontSize: 11, color: "#4ECDC4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>◈ Portion Advisor</div>
              {remaining.calories <= 0 ? (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                  You've hit your calorie goal today 🎯 Focus on hydration and rest. Light veggies or herbal tea if hungry.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                  {remaining.protein > 20 && <div>🥩 You still need <strong style={{ color: "#4ECDC4" }}>{remaining.protein}g protein</strong> — consider a lean protein source next meal.</div>}
                  {remaining.carbs > 30 && <div>🌾 <strong style={{ color: "#FFE66D" }}>{remaining.carbs}g carbs</strong> remaining — great for energy before workouts.</div>}
                  {remaining.fat < 10 && totals.fat > 0 && <div>⚠️ Fat is nearly maxed out — choose low-fat options for remaining meals.</div>}
                  {remaining.calories > 0 && remaining.protein <= 20 && remaining.carbs <= 30 && <div>✓ You're well-balanced! {remaining.calories} kcal remaining for a light snack.</div>}
                </div>
              )}
            </Card>


            {/* Workout & Creatine quick status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {/* Workout status */}
              <div onClick={() => setTab("workout")} style={{
                padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                background: (workoutLog[todayKey]?.types?.length > 0) ? "rgba(255,107,53,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${(workoutLog[todayKey]?.types?.length > 0) ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.07)"}`,
                transition: "all 0.2s"
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>
                  {workoutLog[todayKey]?.types?.includes("rest") ? "😴" : (workoutLog[todayKey]?.types?.length > 0) ? "⚡" : "○"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: (workoutLog[todayKey]?.types?.length > 0) ? "#FF6B35" : "rgba(255,255,255,0.4)" }}>
                  {workoutLog[todayKey]?.types?.includes("rest") ? "Rest Day" : (workoutLog[todayKey]?.types?.length > 0) ? workoutLog[todayKey].types.slice(0,1).map(id => ({ upper:"Upper",lower:"Lower",full:"Full Body",cardio:"Cardio",walking:"Walk",running:"Run",cycling:"Cycle",swimming:"Swim",basketball:"Bball",tennis:"Tennis",yoga:"Yoga",hiit:"HIIT",sports:"Sport" })[id] || id).join("") : "Log Workout"}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Today</div>
              </div>
              {/* Creatine status */}
              <div onClick={() => { setCreatineLog(prev => ({ ...prev, [todayKey]: !prev[todayKey] })); }} style={{
                padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                background: creatineLog[todayKey] ? "rgba(200,180,248,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${creatineLog[todayKey] ? "rgba(200,180,248,0.3)" : "rgba(255,255,255,0.07)"}`,
                transition: "all 0.2s"
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{creatineLog[todayKey] ? "✓" : "○"}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: creatineLog[todayKey] ? "#C8B4F8" : "rgba(255,255,255,0.4)" }}>
                  {creatineLog[todayKey] ? "Taken!" : "Creatine"}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Tap to toggle</div>
              </div>
            </div>

            {/* Today's meals list */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Today's Log</div>
              {todayMeals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No meals logged today.<br />Tap <strong>Log</strong> to add your first entry.</div>
              ) : (
                todayMeals.map(m => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", marginBottom: 8, borderRadius: 12,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                        <Tag color="#4ECDC4">{m.mealTime}</Tag>
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                        {m.calories}kcal · P:{m.protein}g · C:{m.carbs}g · F:{m.fat}g · {m.time}
                      </div>
                    </div>
                    <button onClick={() => removeMeal(m.id)} style={{
                      background: "none", border: "none", color: "rgba(255,80,80,0.5)", cursor: "pointer", fontSize: 16, padding: 4
                    }}>×</button>
                  </div>
                ))
              )}
            </div>

            {/* View history shortcut */}
            {meals.filter(m => m.date && m.date !== todayKey).length > 0 && (
              <button onClick={() => setTab("history")} style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8
              }}>📅 View Previous Days →</button>
            )}
          </div>
        )}

        {/* --- HISTORY --- */}
        {tab === "history" && (() => {
          const WORKOUT_TYPE_LABELS = { upper:"Upper Body", lower:"Lower Body", full:"Full Body", cardio:"Cardio", walking:"Walking", running:"Running", cycling:"Cycling", swimming:"Swimming", basketball:"Basketball", tennis:"Tennis", yoga:"Yoga/Stretch", hiit:"HIIT", sports:"Other Sport", rest:"Rest Day" };

          // All dates with any data, newest first (include today too for averages)
          const allDatesSet = Array.from(new Set([
            ...meals.filter(m => m.date).map(m => m.date),
            ...Object.keys(workoutLog),
            ...Object.keys(creatineLog),
          ])).sort((a, b) => b.localeCompare(a));

          const allPastDates = allDatesSet.filter(d => d !== todayKey);
          const viewDate = historyDate || (allPastDates[0] || null);

          // ── Averages calculation ──────────────────────────────────────────
          const periodDays = avgPeriod;
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - periodDays);
          const cutoffStr = cutoff.toISOString().split("T")[0];

          // Get days in period that have meal data
          const periodMealDays = allDatesSet.filter(d => d >= cutoffStr);
          const daysWithMeals = periodMealDays.filter(d => meals.some(m => m.date === d));
          const n = daysWithMeals.length;

          const periodTotals = daysWithMeals.reduce((acc, date) => {
            const dayMs = meals.filter(m => m.date === date);
            dayMs.forEach(m => {
              acc.cal += m.calories; acc.p += m.protein; acc.c += m.carbs; acc.f += m.fat;
            });
            return acc;
          }, { cal:0, p:0, c:0, f:0 });

          const avgs = n > 0
            ? { cal: Math.round(periodTotals.cal/n), p: Math.round(periodTotals.p/n), c: Math.round(periodTotals.c/n), f: Math.round(periodTotals.f/n) }
            : null;

          // Workout days in period
          const workoutDaysInPeriod = periodMealDays.filter(d => workoutLog[d]?.types?.length > 0 && !workoutLog[d]?.types?.includes("rest")).length;
          const creatineDaysInPeriod = periodMealDays.filter(d => creatineLog[d]).length;

          // Calorie trend for sparkline — last periodDays days with meal data
          const trendDays = [...daysWithMeals].sort((a,b) => a.localeCompare(b)).slice(-Math.min(n, 30));
          const trendData = trendDays.map(date => ({
            date,
            cal: meals.filter(m => m.date === date).reduce((s, m) => s + m.calories, 0)
          }));

          // Compliance: how many days hit >=80% of calorie goal
          const compliance = n > 0
            ? Math.round((daysWithMeals.filter(d => {
                const dc = meals.filter(m => m.date === d).reduce((s,m) => s+m.calories, 0);
                return dc >= goals.calories * 0.8 && dc <= goals.calories * 1.2;
              }).length / n) * 100)
            : 0;

          if (allPastDates.length === 0 && n === 0) return (
            <div style={{ textAlign: "center", paddingTop: 60, paddingBottom: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No history yet</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                Start logging meals and workouts.<br />They'll appear here day by day.
              </div>
            </div>
          );

          const dayMeals = viewDate ? meals.filter(m => m.date === viewDate) : [];
          const dayTotals = dayMeals.reduce((a, m) => ({ cal: a.cal+m.calories, p: a.p+m.protein, c: a.c+m.carbs, f: a.f+m.fat }), { cal:0, p:0, c:0, f:0 });
          const dayWorkout = viewDate ? workoutLog[viewDate] : null;
          const dayCreatine = viewDate ? creatineLog[viewDate] : null;

          // Mini sparkline
          const spW = 320, spH = 72;
          let spPath = "", spArea = "";
          if (trendData.length > 1) {
            const vals = trendData.map(d => d.cal);
            const minV = Math.min(...vals, 0), maxV = Math.max(...vals, goals.calories);
            const range = maxV - minV || 1;
            const pts = trendData.map((d, i) => {
              const x = (i / (trendData.length - 1)) * spW;
              const y = spH - ((d.cal - minV) / range) * (spH - 16) - 4;
              return { x, y };
            });
            spPath = "M" + pts.map(p => `${p.x},${p.y}`).join(" L");
            spArea = spPath + ` L${pts[pts.length-1].x},${spH} L0,${spH} Z`;
            // Goal line y
            const goalY = spH - ((goals.calories - minV) / range) * (spH - 16) - 4;
            var goalLineY = goalY;
          }

          return (
            <div style={{ paddingBottom: 40 }}>

              {/* ── AVERAGES SECTION ── */}
              <Card style={{ marginBottom: 16, borderColor: "rgba(255,107,53,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>📊 Average Intake</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {n > 0 ? `Based on ${n} logged day${n !== 1 ? "s" : ""}` : "No data in this period"}
                    </div>
                  </div>
                  {/* Period selector */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {[7, 14, 30, 90].map(p => (
                      <button key={p} onClick={() => setAvgPeriod(p)} style={{
                        padding: "5px 9px", borderRadius: 8, border: `1px solid ${avgPeriod === p ? "#FF6B35" : "rgba(255,255,255,0.1)"}`,
                        background: avgPeriod === p ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.03)",
                        color: avgPeriod === p ? "#FF6B35" : "rgba(255,255,255,0.4)",
                        fontSize: 11, fontWeight: avgPeriod === p ? 700 : 400, cursor: "pointer"
                      }}>{p}d</button>
                    ))}
                  </div>
                </div>

                {avgs ? (
                  <>
                    {/* Calorie trend sparkline */}
                    {trendData.length > 1 && (
                      <div style={{ marginBottom: 16 }}>
                        <svg width="100%" viewBox={`0 0 ${spW} ${spH}`} style={{ display: "block", overflow: "visible" }}>
                          <defs>
                            <linearGradient id="calgrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {/* Goal line */}
                          {goalLineY !== undefined && (
                            <line x1="0" y1={goalLineY} x2={spW} y2={goalLineY}
                              stroke="#FF6B35" strokeWidth="1" strokeDasharray="4,4" opacity="0.3" />
                          )}
                          <path d={spArea} fill="url(#calgrad)" />
                          <path d={spPath} fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ filter: "drop-shadow(0 0 4px #FF6B3588)" }} />
                          {trendData.map((d, i) => {
                            const vals = trendData.map(x => x.cal);
                            const minV = Math.min(...vals, 0), maxV = Math.max(...vals, goals.calories);
                            const range = maxV - minV || 1;
                            const x = (i / (trendData.length - 1)) * spW;
                            const y = spH - ((d.cal - minV) / range) * (spH - 16) - 4;
                            return <circle key={i} cx={x} cy={y} r="2.5" fill="#FF6B35" />;
                          })}
                        </svg>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                          <span>{trendData.length > 0 ? new Date(trendData[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                          <span style={{ color: "rgba(255,107,53,0.5)" }}>— goal</span>
                          <span>{trendData.length > 0 ? new Date(trendData[trendData.length-1].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                        </div>
                      </div>
                    )}

                    {/* Avg macro bars vs goal */}
                    <div style={{ marginBottom: 14 }}>
                      {[
                        { label: "Avg Calories", val: avgs.cal, goal: goals.calories, color: "#FF6B35", unit: "kcal" },
                        { label: "Avg Protein",  val: avgs.p,   goal: goals.protein,  color: "#4ECDC4", unit: "g" },
                        { label: "Avg Carbs",    val: avgs.c,   goal: goals.carbs,    color: "#FFE66D", unit: "g" },
                        { label: "Avg Fat",      val: avgs.f,   goal: goals.fat,      color: "#A8DADC", unit: "g" },
                      ].map(({ label, val, goal, color, unit }) => {
                        const pct = Math.min((val / (goal || 1)) * 100, 100);
                        const over = val > goal;
                        return (
                          <div key={label} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                              <span style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", color: over ? "#FF6B6B" : "#fff" }}>
                                {val}{unit} <span style={{ color: "rgba(255,255,255,0.3)" }}>/ {goal}{unit}</span>
                                <span style={{ marginLeft: 6, fontSize: 10, color: over ? "#FF6B6B" : val >= goal * 0.9 ? "#4ECDC4" : "rgba(255,255,255,0.3)" }}>
                                  {Math.round((val/goal)*100)}%
                                </span>
                              </span>
                            </div>
                            <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${pct}%`, borderRadius: 4,
                                background: over ? "#FF6B6B" : color,
                                boxShadow: `0 0 8px ${over ? "#FF6B6B" : color}66`,
                                transition: "width 0.6s cubic-bezier(.4,0,.2,1)"
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats row: compliance + workout + creatine */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {[
                        { icon: "🎯", val: `${compliance}%`, label: "Goal days", color: compliance >= 80 ? "#4ECDC4" : compliance >= 50 ? "#FFE66D" : "#FF6B6B" },
                        { icon: "⚡", val: workoutDaysInPeriod, label: "Workouts", color: "#FF6B35" },
                        { icon: "💊", val: creatineDaysInPeriod, label: "Creatine", color: "#C8B4F8" },
                      ].map(({ icon, val, label, color }) => (
                        <div key={label} style={{ textAlign: "center", padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ fontSize: 16, marginBottom: 3 }}>{icon}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color }}>{val}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    No meals logged in the last {periodDays} days
                  </div>
                )}
              </Card>

              {/* ── DAY BROWSER ── */}
              {allPastDates.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Browse Days</div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch", marginBottom: 16 }}>
                    {allPastDates.map(date => {
                      const d = new Date(date + "T12:00:00");
                      const isSelected = date === viewDate;
                      const hasMeals = meals.some(m => m.date === date);
                      const hasWorkout = workoutLog[date]?.types?.length > 0;
                      return (
                        <button key={date} onClick={() => setHistoryDate(date)} style={{
                          minWidth: 58, padding: "10px 8px", borderRadius: 12, border: `1px solid ${isSelected ? "#4ECDC4" : "rgba(255,255,255,0.08)"}`,
                          background: isSelected ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.03)",
                          color: isSelected ? "#4ECDC4" : "rgba(255,255,255,0.5)",
                          cursor: "pointer", textAlign: "center", flexShrink: 0,
                          boxShadow: isSelected ? "0 0 12px rgba(78,205,196,0.2)" : "none"
                        }}>
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700 }}>
                            {d.getDate()}
                          </div>
                          <div style={{ fontSize: 9, color: isSelected ? "rgba(78,205,196,0.7)" : "rgba(255,255,255,0.25)", marginTop: 2 }}>
                            {d.toLocaleDateString("en-US", { month: "short" })}
                          </div>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 4 }}>
                            {hasMeals && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#FF6B35" }} />}
                            {hasWorkout && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ECDC4" }} />}
                            {creatineLog[date] && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#C8B4F8" }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {viewDate && (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#fff" }}>
                        {new Date(viewDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </div>

                      {dayMeals.length > 0 && (
                        <Card style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Macros Reached</div>
                          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 14 }}>
                            <Ring value={dayTotals.cal} max={goals.calories} color={MACRO_COLORS.calories} size={80} stroke={8} label="kcal" />
                            <Ring value={dayTotals.p} max={goals.protein} color={MACRO_COLORS.protein} size={68} stroke={7} label="P" />
                            <Ring value={dayTotals.c} max={goals.carbs} color={MACRO_COLORS.carbs} size={68} stroke={7} label="C" />
                            <Ring value={dayTotals.f} max={goals.fat} color={MACRO_COLORS.fat} size={68} stroke={7} label="F" />
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            {[["🔥", dayTotals.cal, goals.calories, "kcal", "#FF6B35"], ["💪", dayTotals.p, goals.protein, "g P", "#4ECDC4"], ["🌾", dayTotals.c, goals.carbs, "g C", "#FFE66D"], ["🥑", dayTotals.f, goals.fat, "g F", "#A8DADC"]].map(([icon, val, goal, unit, c]) => (
                              <div key={unit} style={{ padding: "4px 10px", borderRadius: 16, background: `${c}12`, border: `1px solid ${c}25`, fontSize: 11, fontFamily: "'DM Mono', monospace", color: c }}>
                                {icon} {val}/{goal}{unit}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {dayMeals.length > 0 ? (
                        <Card style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Meals Logged</div>
                          {dayMeals.map(m => (
                            <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                                <Tag color="#4ECDC4">{m.mealTime}</Tag>
                              </div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                                {m.calories}kcal · P:{m.protein}g · C:{m.carbs}g · F:{m.fat}g{m.time ? ` · ${m.time}` : ""}
                              </div>
                            </div>
                          ))}
                        </Card>
                      ) : (
                        <Card style={{ marginBottom: 14, textAlign: "center", padding: "20px" }}>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No meals logged this day</div>
                        </Card>
                      )}

                      <Card style={{ marginBottom: 14, borderColor: dayWorkout?.types?.length > 0 ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Workout</div>
                        {dayWorkout?.types?.length > 0 ? (
                          <>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: dayWorkout.note ? 10 : 0 }}>
                              {dayWorkout.types.map(id => (
                                <Tag key={id} color={id === "rest" ? "rgba(255,255,255,0.3)" : "#FF6B35"}>{WORKOUT_TYPE_LABELS[id] || id}</Tag>
                              ))}
                            </div>
                            {dayWorkout.note && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, fontStyle: "italic" }}>"{dayWorkout.note}"</div>}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No workout logged</div>
                        )}
                      </Card>

                      <Card style={{ borderColor: dayCreatine ? "rgba(200,180,248,0.25)" : "rgba(255,255,255,0.08)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>Creatine</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: dayCreatine ? "#C8B4F8" : "rgba(255,255,255,0.25)" }}>
                            {dayCreatine ? "✓ Taken" : "✗ Not logged"}
                          </div>
                        </div>
                      </Card>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* --- LOG --- */}
        {tab === "log" && (
          <div style={{ paddingBottom: 40 }}>

            <DatePicker value={logDate} onChange={setLogDate} todayKey={todayKey} label="Logging meals for" />

            {/* Barcode Scanner Card */}
            <Card style={{ marginBottom: 16, borderColor: "rgba(255,230,109,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: scanMode ? 14 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>📷 Barcode Scanner</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Enter a UPC barcode to auto-fill macros</div>
                </div>
                <button onClick={() => { setScanMode(p => !p); setBarcodeResult(null); setBarcodeError(""); }} style={{
                  padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(255,230,109,0.25)",
                  background: scanMode ? "rgba(255,230,109,0.15)" : "rgba(255,255,255,0.04)",
                  color: scanMode ? "#FFE66D" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, cursor: "pointer"
                }}>{scanMode ? "✕ Close" : "Open"}</button>
              </div>

              {scanMode && (
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10, lineHeight: 1.6 }}>
                    Find the barcode number printed under the barcode on the package and type it below.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input
                      style={{ ...inputStyle, flex: 1, borderColor: "rgba(255,230,109,0.25)" }}
                      type="number" placeholder="e.g. 0123456789012"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && lookupBarcode(barcodeInput)}
                    />
                    <button onClick={() => lookupBarcode(barcodeInput)} disabled={barcodeLoading || !barcodeInput.trim()} style={{
                      padding: "0 16px", borderRadius: 10, border: "none",
                      background: barcodeLoading || !barcodeInput.trim() ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #FFE66D, #e0c84a)",
                      color: barcodeLoading || !barcodeInput.trim() ? "rgba(255,255,255,0.2)" : "#0C0C14",
                      fontWeight: 700, fontSize: 13, cursor: barcodeLoading || !barcodeInput.trim() ? "default" : "pointer"
                    }}>{barcodeLoading ? "..." : "Lookup"}</button>
                  </div>

                  {barcodeError && (
                    <div style={{ fontSize: 12, color: "#FF6B6B", padding: "8px 12px", borderRadius: 8, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)" }}>
                      ⚠️ {barcodeError}
                    </div>
                  )}

                  {barcodeResult && (
                    <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,230,109,0.06)", border: "1px solid rgba(255,230,109,0.2)" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                        {barcodeResult.image && <img src={barcodeResult.image} alt="" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.1)" }} />}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{barcodeResult.name}</div>
                          {barcodeResult.brand && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{barcodeResult.brand}</div>}
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Per {barcodeResult.servingSize}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {[["🔥", barcodeResult.calories, "kcal", "#FF6B35"], ["💪", barcodeResult.protein, "g P", "#4ECDC4"], ["🌾", barcodeResult.carbs, "g C", "#FFE66D"], ["🥑", barcodeResult.fat, "g F", "#A8DADC"]].map(([icon, val, unit, c]) => (
                          <div key={unit} style={{ padding: "4px 10px", borderRadius: 16, background: `${c}15`, border: `1px solid ${c}30`, fontFamily: "'DM Mono', monospace", fontSize: 12, color: c }}>
                            {icon} {val}{unit}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => applyBarcodeToForm(barcodeResult)} style={{
                        width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg, #FFE66D, #e0c84a)", color: "#0C0C14",
                        fontWeight: 700, fontSize: 13, cursor: "pointer"
                      }}>✓ Use This Product</button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Log a Food / Meal</div>
                {logDate !== todayKey && (
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(255,230,109,0.15)", color: "#FFE66D", border: "1px solid rgba(255,230,109,0.3)" }}>
                    ⏪ Past Entry
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Food / Meal Name</label>
                <input style={inputStyle} placeholder="e.g. Grilled Chicken Breast" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Meal Time</label>
                <select style={{ ...inputStyle, appearance: "none" }} value={addForm.mealTime} onChange={e => setAddForm(p => ({ ...p, mealTime: e.target.value }))}>
                  {MEAL_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[["Calories (kcal)", "calories", "#FF6B35"], ["Protein (g)", "protein", "#4ECDC4"], ["Carbs (g)", "carbs", "#FFE66D"], ["Fat (g)", "fat", "#A8DADC"]].map(([l, k, c]) => (
                  <div key={k}>
                    <label style={{ ...labelStyle, color: c }}>{l}</label>
                    <input style={{ ...inputStyle, borderColor: `${c}33` }} type="number" min="0" placeholder="0" value={addForm[k]} onChange={e => setAddForm(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button onClick={addMeal} style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #4ECDC4, #44A5A0)", color: "#0C0C14",
                fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 0.5,
                boxShadow: "0 4px 20px rgba(78,205,196,0.3)"
              }}>+ Add to Log</button>
            </Card>

            {/* Quick macros guide */}
            <Card style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Quick Reference (per 100g)</div>
              {[
                { name: "Chicken Breast", cal: 165, p: 31, c: 0, f: 4 },
                { name: "Brown Rice (cooked)", cal: 111, p: 3, c: 23, f: 1 },
                { name: "Eggs (large)", cal: 155, p: 13, c: 1, f: 11 },
                { name: "Greek Yogurt", cal: 59, p: 10, c: 4, f: 0 },
                { name: "Salmon", cal: 208, p: 20, c: 0, f: 13 },
                { name: "Avocado", cal: 160, p: 2, c: 9, f: 15 },
              ].map(item => (
                <div key={item.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)"
                }}>
                  <span style={{ fontSize: 13 }}>{item.name}</span>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>
                    <span style={{ color: "#FF6B35" }}>{item.cal}kcal</span> · P:{item.p}g · C:{item.c}g · F:{item.f}g
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* --- MEAL IDEAS --- */}
        {tab === "ideas" && (
          <div style={{ paddingBottom: 40 }}>

            {/* Header + refresh */}
            <Card style={{ marginBottom: 16, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Smart Meal Planner</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Adjusted to your remaining macros</div>
                </div>
                <button onClick={() => fetchSmartSuggestions(meals, goals)} disabled={smartLoading || meals.length === 0} style={{
                  padding: "8px 14px", borderRadius: 10, border: "none",
                  background: smartLoading || meals.length === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,107,53,0.15)",
                  color: smartLoading || meals.length === 0 ? "rgba(255,255,255,0.25)" : "#FF6B35",
                  fontSize: 11, fontWeight: 700, cursor: smartLoading || meals.length === 0 ? "default" : "pointer",
                  border: "1px solid rgba(255,107,53,0.2)"
                }}>
                  {smartLoading ? "..." : "↻ Refresh"}
                </button>
              </div>
              {/* Remaining macros pill row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {[["🔥", remaining.calories, "kcal", "#FF6B35"], ["💪", remaining.protein, "g P", "#4ECDC4"], ["🌾", remaining.carbs, "g C", "#FFE66D"], ["🥑", remaining.fat, "g F", "#A8DADC"]].map(([icon, val, unit, color]) => (
                  <div key={unit} style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11,
                    background: `${color}15`, border: `1px solid ${color}30`,
                    fontFamily: "'DM Mono', monospace", color
                  }}>{icon} {val > 0 ? val : 0}{unit}</div>
                ))}
              </div>
            </Card>

            {/* No meals logged yet */}
            {meals.length === 0 && !smartLoading && (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Log your first meal to get started</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Once you log breakfast or a snack, smart suggestions for the rest of your day will appear here — automatically adjusted to your remaining macros.
                </div>
                <button onClick={() => setTab("log")} style={{
                  marginTop: 20, padding: "11px 24px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #4ECDC4, #44A5A0)", color: "#0C0C14",
                  fontWeight: 700, fontSize: 13, cursor: "pointer"
                }}>+ Log a Meal</button>
              </div>
            )}

            {/* Loading skeleton */}
            {smartLoading && (
              <div>
                {[1, 2, 3].map(i => (
                  <Card key={i} style={{ marginBottom: 14, padding: 20 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                      <div style={{ width: 60, height: 18, borderRadius: 6, background: "rgba(255,255,255,0.07)", animation: "shimmer 1.4s infinite" }} />
                      <div style={{ width: 120, height: 18, borderRadius: 6, background: "rgba(255,255,255,0.05)", animation: "shimmer 1.4s infinite 0.2s" }} />
                    </div>
                    <div style={{ width: "80%", height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 8, animation: "shimmer 1.4s infinite 0.4s" }} />
                    <div style={{ width: "60%", height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.4s infinite 0.6s" }} />
                  </Card>
                ))}
                <style>{`@keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
              </div>
            )}

            {/* AI Summary banner */}
            {smartSuggestions?.summary && !smartLoading && (
              <div style={{
                padding: "12px 16px", borderRadius: 12, marginBottom: 16,
                background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)",
                fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6
              }}>
                ◈ {smartSuggestions.summary}
              </div>
            )}

            {/* Suggestion cards */}
            {!smartLoading && smartSuggestions?.suggestions?.map((s, idx) => {
              const [open, setOpen] = useState(false);
              const colors = ["#FF6B35", "#4ECDC4", "#C8B4F8"];
              const c = colors[idx % colors.length];
              return (
                <Card key={idx} style={{ marginBottom: 14, borderColor: `${c}22` }}>
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Tag color={c}>{s.mealTime}</Tag>
                        {s.prepTime && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>⏱ {s.prepTime}</span>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s.description}</div>
                    </div>
                  </div>

                  {/* Portion note */}
                  {s.portionNote && (
                    <div style={{
                      padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                      background: `${c}12`, border: `1px solid ${c}25`,
                      fontSize: 12, color: "rgba(255,255,255,0.8)"
                    }}>
                      📏 <strong>Portion:</strong> {s.portionNote}
                    </div>
                  )}

                  {/* Macro chips */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    {[["🔥", s.macros?.calories, "kcal", "#FF6B35"], ["💪", s.macros?.protein, "g P", "#4ECDC4"], ["🌾", s.macros?.carbs, "g C", "#FFE66D"], ["🥑", s.macros?.fat, "g F", "#A8DADC"]].map(([icon, val, unit, mc]) => (
                      <div key={unit} style={{
                        padding: "3px 9px", borderRadius: 16, fontSize: 11,
                        background: `${mc}12`, border: `1px solid ${mc}28`,
                        fontFamily: "'DM Mono', monospace", color: mc
                      }}>{icon} {val || 0}{unit}</div>
                    ))}
                  </div>

                  {/* Balance reason */}
                  {s.balanceReason && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic", marginBottom: 10 }}>
                      ✦ {s.balanceReason}
                    </div>
                  )}

                  {/* Expand/collapse prep */}
                  <button onClick={() => setOpen(o => !o)} style={{
                    width: "100%", padding: "9px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5
                  }}>
                    {open ? "▲ Hide Prep Details" : "▼ Show Ingredients & Steps"}
                  </button>

                  {open && (
                    <div style={{ marginTop: 14 }}>
                      {s.ingredients?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ingredients</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {s.ingredients.map((ing, ii) => (
                              <span key={ii} style={{
                                fontSize: 12, padding: "4px 10px", borderRadius: 20,
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"
                              }}>{ing}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.prepSteps?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Prep Steps</div>
                          {s.prepSteps.map((step, si) => (
                            <div key={si} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: c, minWidth: 18 }}>{si + 1}.</span>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Manual refresh if no suggestions yet but meals logged */}
            {meals.length > 0 && !smartSuggestions && !smartLoading && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Generate smart suggestions based on what you've eaten today.</div>
                <button onClick={() => fetchSmartSuggestions(meals, goals)} style={{
                  padding: "12px 28px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #FF6B35, #e5521f)", color: "#fff",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(255,107,53,0.3)"
                }}>✦ Generate Meal Plan</button>
              </div>
            )}
          </div>
        )}

        {/* --- WEIGHT --- */}
        {tab === "weight" && (() => {
          const sorted = [...weightLog].sort((a, b) => new Date(a.date) - new Date(b.date));
          const latest = sorted[sorted.length - 1]?.weight ?? null;
          const first = sorted[0]?.weight ?? null;
          const totalChange = latest !== null && first !== null ? (latest - first) : null;
          const goalNum = parseFloat(weightGoal) || null;
          const toGoal = latest !== null && goalNum !== null ? (latest - goalNum) : null;

          // Mini sparkline path
          const sparkW = 320, sparkH = 80;
          let sparkPath = "";
          if (sorted.length > 1) {
            const vals = sorted.map(e => e.weight);
            const minV = Math.min(...vals), maxV = Math.max(...vals);
            const range = maxV - minV || 1;
            const pts = sorted.map((e, i) => {
              const x = (i / (sorted.length - 1)) * sparkW;
              const y = sparkH - ((e.weight - minV) / range) * (sparkH - 16) - 8;
              return `${x},${y}`;
            });
            sparkPath = "M" + pts.join(" L");
          }

          function addWeight() {
            const w = parseFloat(weightInput);
            if (!w || w <= 0) return;
            setWeightLog(prev => {
              const filtered = prev.filter(e => e.date !== logDate);
              return [...filtered, { id: Date.now(), date: logDate, weight: w }];
            });
            setWeightInput("");
          }

          function removeWeight(id) { setWeightLog(prev => prev.filter(e => e.id !== id)); }

          return (
            <div style={{ paddingBottom: 40 }}>
              <DatePicker value={logDate} onChange={setLogDate} todayKey={todayKey} label="Logging weight for" />
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Current", value: latest ? `${latest}` : "—", unit: latest ? weightUnit : "", color: "#C8B4F8" },
                  { label: "Change", value: totalChange !== null ? (totalChange > 0 ? `+${totalChange.toFixed(1)}` : totalChange.toFixed(1)) : "—", unit: totalChange !== null ? weightUnit : "", color: totalChange === null ? "#888" : totalChange <= 0 ? "#4ECDC4" : "#FF6B6B" },
                  { label: "To Goal", value: toGoal !== null ? (Math.abs(toGoal) < 0.1 ? "✓" : (toGoal > 0 ? `-${toGoal.toFixed(1)}` : `+${Math.abs(toGoal).toFixed(1)}`)) : "—", unit: toGoal !== null && Math.abs(toGoal) >= 0.1 ? weightUnit : "", color: toGoal === null ? "#888" : Math.abs(toGoal) < 0.5 ? "#4ECDC4" : "#FFE66D" },
                ].map(({ label, value, unit, color }) => (
                  <Card key={label} style={{ textAlign: "center", padding: "14px 8px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color }}>{value}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>{unit}</span></div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{label}</div>
                  </Card>
                ))}
              </div>

              {/* Sparkline chart */}
              <Card style={{ marginBottom: 16, padding: "16px 16px 12px" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Weight History</div>
                {sorted.length < 2 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Log at least 2 entries to see your trend chart.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <svg width="100%" viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ display: "block" }}>
                      <defs>
                        <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C8B4F8" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#C8B4F8" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Fill area */}
                      {sparkPath && (
                        <path d={`${sparkPath} L${sparkW},${sparkH} L0,${sparkH} Z`} fill="url(#wgrad)" />
                      )}
                      {/* Line */}
                      {sparkPath && (
                        <path d={sparkPath} fill="none" stroke="#C8B4F8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ filter: "drop-shadow(0 0 4px #C8B4F888)" }} />
                      )}
                      {/* Dots */}
                      {sorted.map((e, i) => {
                        const vals = sorted.map(x => x.weight);
                        const minV = Math.min(...vals), maxV = Math.max(...vals);
                        const range = maxV - minV || 1;
                        const x = (i / (sorted.length - 1)) * sparkW;
                        const y = sparkH - ((e.weight - minV) / range) * (sparkH - 16) - 8;
                        return <circle key={e.id} cx={x} cy={y} r="3" fill="#C8B4F8" style={{ filter: "drop-shadow(0 0 3px #C8B4F8)" }} />;
                      })}
                    </svg>
                    {/* X-axis labels */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {[sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]].filter(Boolean).map((e, i) => (
                        <div key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
                          {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Log entry */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {logDate === todayKey ? "Log Today's Weight" : `Log Weight for ${new Date(logDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </div>
                  {logDate !== todayKey && (
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(255,230,109,0.15)", color: "#FFE66D", border: "1px solid rgba(255,230,109,0.3)" }}>⏪ Past Entry</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    type="number" min="0" step="0.1" placeholder="e.g. 175.5"
                    style={{ ...inputStyle, flex: 1, borderColor: "rgba(200,180,248,0.25)" }}
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addWeight()}
                  />
                  <select style={{ ...inputStyle, width: 70, appearance: "none", textAlign: "center", borderColor: "rgba(200,180,248,0.2)" }}
                    value={weightUnit} onChange={e => setWeightUnit(e.target.value)}>
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                  <button onClick={addWeight} style={{
                    padding: "0 16px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #C8B4F8, #a88de0)", color: "#0C0C14",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(200,180,248,0.25)"
                  }}>+ Log</button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>Goal weight:</span>
                  <input
                    type="number" min="0" step="0.1" placeholder={`Target ${weightUnit}`}
                    style={{ ...inputStyle, flex: 1, fontSize: 12, borderColor: "rgba(255,230,109,0.2)" }}
                    value={weightGoal}
                    onChange={e => setWeightGoal(e.target.value)}
                  />
                </div>
              </Card>

              {/* History list */}
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Log History</div>
                {sorted.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>No entries yet. Log your first weight above.</div>
                ) : (
                  [...sorted].reverse().map((entry, i) => {
                    const prev = sorted[sorted.length - 2 - i];
                    const diff = prev ? entry.weight - prev.weight : null;
                    return (
                      <div key={entry.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", marginBottom: 6, borderRadius: 12,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)"
                      }}>
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: "#C8B4F8" }}>
                            {entry.weight} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{weightUnit}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                            {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {diff !== null && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: diff <= 0 ? "#4ECDC4" : "#FF6B6B" }}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          )}
                          <button onClick={() => removeWeight(entry.id)} style={{ background: "none", border: "none", color: "rgba(255,80,80,0.4)", cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}


        {/* --- WORKOUT --- */}
        {tab === "workout" && (() => {
          const WORKOUT_TYPES = [
            { id: "upper", label: "Upper Body", icon: "💪", color: "#FF6B35" },
            { id: "lower", label: "Lower Body", icon: "🦵", color: "#4ECDC4" },
            { id: "full", label: "Full Body", icon: "🏋️", color: "#C8B4F8" },
            { id: "cardio", label: "Cardio", icon: "🫀", color: "#FF6B6B" },
            { id: "walking", label: "Walking", icon: "🚶", color: "#FFE66D" },
            { id: "running", label: "Running", icon: "🏃", color: "#FF9F43" },
            { id: "cycling", label: "Cycling", icon: "🚴", color: "#54A0FF" },
            { id: "swimming", label: "Swimming", icon: "🏊", color: "#48DBFB" },
            { id: "basketball", label: "Basketball", icon: "🏀", color: "#FF9F43" },
            { id: "tennis", label: "Tennis", icon: "🎾", color: "#A8DADC" },
            { id: "yoga", label: "Yoga / Stretch", icon: "🧘", color: "#C8B4F8" },
            { id: "hiit", label: "HIIT", icon: "⚡", color: "#FF6B35" },
            { id: "sports", label: "Other Sport", icon: "🏅", color: "#4ECDC4" },
            { id: "rest", label: "Rest Day", icon: "😴", color: "rgba(255,255,255,0.3)" },
          ];

          const activeWorkoutKey = logDate;
          const todayWorkout = workoutLog[activeWorkoutKey] || { types: [], note: "" };
          const creatineTaken = !!creatineLog[activeWorkoutKey];

          function toggleWorkoutType(id) {
            if (id === "rest") {
              setWorkoutLog(prev => ({ ...prev, [activeWorkoutKey]: { ...todayWorkout, types: todayWorkout.types.includes("rest") ? [] : ["rest"] } }));
              return;
            }
            const current = todayWorkout.types.filter(t => t !== "rest");
            const updated = current.includes(id) ? current.filter(t => t !== id) : [...current, id];
            setWorkoutLog(prev => ({ ...prev, [activeWorkoutKey]: { ...todayWorkout, types: updated } }));
          }

          function toggleCreatine(dateKey) {
            setCreatineLog(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
          }

          // Build last 14 days for history
          const last14 = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (13 - i));
            return d.toISOString().split("T")[0];
          });

          const workoutStreak = (() => {
            let streak = 0;
            for (let i = 0; i < 30; i++) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const key = d.toISOString().split("T")[0];
              const w = workoutLog[key];
              if (w && w.types.length > 0 && !w.types.includes("rest")) streak++;
              else if (i > 0) break;
            }
            return streak;
          })();

          const creatineStreak = (() => {
            let streak = 0;
            for (let i = 0; i < 30; i++) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const key = d.toISOString().split("T")[0];
              if (creatineLog[key]) streak++;
              else if (i > 0) break;
            }
            return streak;
          })();

          return (
            <div style={{ paddingBottom: 40 }}>

              <DatePicker value={logDate} onChange={setLogDate} todayKey={todayKey} label="Logging workout for" />

              {/* Streak stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Card style={{ textAlign: "center", padding: "16px 12px", borderColor: "rgba(255,107,53,0.2)" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#FF6B35" }}>{workoutStreak}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Workout Streak</div>
                  <div style={{ fontSize: 10, color: "rgba(255,107,53,0.5)", marginTop: 2 }}>🔥 days in a row</div>
                </Card>
                <Card style={{ textAlign: "center", padding: "16px 12px", borderColor: "rgba(200,180,248,0.2)" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#C8B4F8" }}>{creatineStreak}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>Creatine Streak</div>
                  <div style={{ fontSize: 10, color: "rgba(200,180,248,0.5)", marginTop: 2 }}>💊 days consistent</div>
                </Card>
              </div>

              {/* Today's creatine check */}
              <Card style={{ marginBottom: 16, borderColor: creatineTaken ? "rgba(200,180,248,0.35)" : "rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                      💊 Creatine {logDate === todayKey ? "Today" : new Date(logDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                      {creatineTaken ? "✓ Taken — great consistency!" : "Not marked yet"}
                    </div>
                  </div>
                  <button onClick={() => toggleCreatine(activeWorkoutKey)} style={{
                    width: 52, height: 52, borderRadius: 14, border: "none", cursor: "pointer",
                    background: creatineTaken ? "linear-gradient(135deg, #C8B4F8, #a88de0)" : "rgba(255,255,255,0.07)",
                    fontSize: 22, transition: "all 0.2s",
                    boxShadow: creatineTaken ? "0 4px 16px rgba(200,180,248,0.35)" : "none"
                  }}>
                    {creatineTaken ? "✓" : "○"}
                  </button>
                </div>
              </Card>

              {/* Today's workout */}
              <Card style={{ marginBottom: 16, borderColor: todayWorkout.types.length > 0 ? "rgba(255,107,53,0.25)" : "rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    ⚡ {logDate === todayKey ? "Today's Workout" : new Date(logDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  {logDate !== todayKey && (
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(255,230,109,0.15)", color: "#FFE66D", border: "1px solid rgba(255,230,109,0.3)" }}>⏪ Past Entry</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
                  {todayWorkout.types.length === 0 ? "Tap to log what you did" : `Logged: ${todayWorkout.types.map(id => WORKOUT_TYPES.find(w => w.id === id)?.label || id).join(", ")}`}
                </div>

                {/* Type grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {WORKOUT_TYPES.map(wt => {
                    const active = todayWorkout.types.includes(wt.id);
                    return (
                      <button key={wt.id} onClick={() => toggleWorkoutType(wt.id)} style={{
                        padding: "10px 12px", borderRadius: 12, border: `1px solid ${active ? wt.color : "rgba(255,255,255,0.07)"}`,
                        background: active ? `${wt.color}18` : "rgba(255,255,255,0.03)",
                        color: active ? wt.color : "rgba(255,255,255,0.55)",
                        fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                        boxShadow: active ? `0 0 12px ${wt.color}30` : "none"
                      }}>
                        <span style={{ fontSize: 16 }}>{wt.icon}</span>
                        <span>{wt.label}</span>
                        {active && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Optional note */}
                <input
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 14px", color: "#fff", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }}
                  placeholder="Add a note (e.g. 3 sets bench press, 5k run...)"
                  value={todayWorkout.note || ""}
                  onChange={e => setWorkoutLog(prev => ({ ...prev, [activeWorkoutKey]: { ...todayWorkout, note: e.target.value } }))}
                />
              </Card>

              {/* 14-day history grid */}
              <Card>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Last 14 Days</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 10 }}>
                  {last14.map(dateKey => {
                    const w = workoutLog[dateKey];
                    const c = creatineLog[dateKey];
                    const hasWorkout = w && w.types.length > 0 && !w.types.includes("rest");
                    const isRest = w && w.types.includes("rest");
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === logDate;
                    const dayLabel = new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
                    const dayNum = new Date(dateKey + "T12:00:00").getDate();
                    return (
                      <div key={dateKey} onClick={() => setLogDate(dateKey)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>{dayLabel}</div>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                          border: isSelected ? "2px solid #4ECDC4" : isToday ? "2px solid #FF6B35" : "1px solid rgba(255,255,255,0.06)",
                          background: isSelected ? "rgba(78,205,196,0.15)" : hasWorkout ? "rgba(255,107,53,0.2)" : isRest ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.03)",
                          color: isSelected ? "#4ECDC4" : hasWorkout ? "#FF6B35" : isRest ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)"
                        }}>
                          {hasWorkout ? "⚡" : isRest ? "😴" : dayNum}
                        </div>
                        {/* Creatine dot */}
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: c ? "#C8B4F8" : "rgba(255,255,255,0.08)", boxShadow: c ? "0 0 4px #C8B4F8" : "none" }} title={c ? "Creatine ✓" : "Creatine ✗"} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(255,107,53,0.3)" }} /> Workout
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8B4F8" }} /> Creatine
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    <span>😴</span> Rest
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* --- COACH --- */}
        {tab === "coach" && (
          <div style={{ paddingBottom: 40 }}>
            <Card style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>AI Nutrition Coach</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Ask about macros, meal timing, adjustments, or anything nutrition-related.</div>
            </Card>

            <div style={{
              minHeight: 260, maxHeight: 360, overflowY: "auto", padding: "4px 0", marginBottom: 12,
              scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent"
            }}>
              {aiChat.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                  Start a conversation with your nutrition coach.
                </div>
              )}
              {aiChat.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 10
                }}>
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user" ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${msg.role === "user" ? "rgba(78,205,196,0.25)" : "rgba(255,255,255,0.08)"}`,
                    fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", color: msg.role === "user" ? "#e0faf9" : "rgba(255,255,255,0.8)"
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", gap: 4, padding: "10px 14px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#4ECDC4",
                      animation: "pulse 1.2s infinite", animationDelay: `${i * 0.2}s`, opacity: 0.6
                    }} />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested prompts */}
            {aiChat.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {["How am I doing today?", "What should I eat for dinner?", "Am I getting enough protein?", "Adjust my portions for tonight"].map(p => (
                  <button key={p} onClick={() => setAiInput(p)} style={{
                    padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer"
                  }}>{p}</button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Ask your nutrition coach..."
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAiMessage()}
              />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()} style={{
                padding: "0 18px", borderRadius: 10, border: "none",
                background: aiLoading || !aiInput.trim() ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #4ECDC4, #44A5A0)",
                color: aiLoading || !aiInput.trim() ? "rgba(255,255,255,0.2)" : "#0C0C14",
                fontWeight: 700, cursor: aiLoading || !aiInput.trim() ? "default" : "pointer",
                fontSize: 16, transition: "all 0.2s"
              }}>→</button>
            </div>
            <style>{`@keyframes pulse { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
          </div>
        )}

        {/* --- GOALS --- */}
        {tab === "goals" && (
          <div style={{ paddingBottom: 40 }}>

            {/* Body Profile / Auto-Calculator */}
            <Card style={{ marginBottom: 16, borderColor: profileSaved ? "rgba(78,205,196,0.3)" : "rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🧬 Smart Macro Calculator</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.6 }}>
                Enter your stats and fitness goal — macros auto-calculate using the Mifflin-St Jeor formula.
              </div>

              {/* Sex + Age */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Biological Sex</label>
                  <select style={{ ...inputStyle, appearance: "none" }} value={bodyProfile.sex}
                    onChange={e => setBodyProfile(p => ({ ...p, sex: e.target.value }))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input type="number" min="10" max="100" placeholder="e.g. 28" style={inputStyle}
                    value={bodyProfile.age} onChange={e => setBodyProfile(p => ({ ...p, age: e.target.value }))} />
                </div>
              </div>

              {/* Height */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Height (ft)</label>
                  <input type="number" min="3" max="8" placeholder="5" style={inputStyle}
                    value={bodyProfile.heightFt} onChange={e => setBodyProfile(p => ({ ...p, heightFt: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Height (in)</label>
                  <input type="number" min="0" max="11" placeholder="10" style={inputStyle}
                    value={bodyProfile.heightIn} onChange={e => setBodyProfile(p => ({ ...p, heightIn: e.target.value }))} />
                </div>
              </div>

              {/* Weight */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Current Weight (lbs)</label>
                <input type="number" min="50" max="600" placeholder="e.g. 175" style={inputStyle}
                  value={bodyProfile.weight} onChange={e => setBodyProfile(p => ({ ...p, weight: e.target.value }))} />
              </div>

              {/* Activity Level */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Activity Level</label>
                <select style={{ ...inputStyle, appearance: "none" }} value={bodyProfile.activityLevel}
                  onChange={e => setBodyProfile(p => ({ ...p, activityLevel: e.target.value }))}>
                  <option value="sedentary">Sedentary (desk job, little exercise)</option>
                  <option value="light">Light (1-3 workouts/week)</option>
                  <option value="moderate">Moderate (3-5 workouts/week)</option>
                  <option value="active">Active (6-7 workouts/week)</option>
                  <option value="very_active">Very Active (2x/day or physical job)</option>
                </select>
              </div>

              {/* Fitness Goal */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Fitness Goal</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { id: "lean_loss", label: "Lose Fat, Stay Lean", icon: "🔥", color: "#FF6B35", desc: "-20% deficit, high protein" },
                    { id: "fat_loss", label: "Aggressive Fat Loss", icon: "📉", color: "#FF6B6B", desc: "-25% deficit" },
                    { id: "maintenance", label: "Maintain Weight", icon: "⚖️", color: "#4ECDC4", desc: "TDEE calories" },
                    { id: "muscle_gain", label: "Lean Muscle Gain", icon: "💪", color: "#FFE66D", desc: "+10% surplus" },
                    { id: "bulk", label: "Bulk Up", icon: "🏋️", color: "#C8B4F8", desc: "+20% surplus" },
                  ].map(g => (
                    <button key={g.id} onClick={() => setBodyProfile(p => ({ ...p, fitnessGoal: g.id }))} style={{
                      padding: "10px 10px", borderRadius: 10, border: `1px solid ${bodyProfile.fitnessGoal === g.id ? g.color : "rgba(255,255,255,0.08)"}`,
                      background: bodyProfile.fitnessGoal === g.id ? `${g.color}15` : "rgba(255,255,255,0.03)",
                      color: bodyProfile.fitnessGoal === g.id ? g.color : "rgba(255,255,255,0.5)",
                      textAlign: "left", cursor: "pointer", transition: "all 0.15s"
                    }}>
                      <div style={{ fontSize: 14, marginBottom: 2 }}>{g.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{g.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview calculated macros */}
              {(() => {
                const preview = calculateMacrosFromProfile(bodyProfile);
                if (!preview) return (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "8px 0" }}>
                    Fill in all fields to see your personalized macros
                  </div>
                );
                return (
                  <div style={{ padding: "12px", borderRadius: 12, background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#4ECDC4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your Personalized Macros</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-around", marginBottom: 8 }}>
                      {[["🔥", preview.calories, "kcal", "#FF6B35"], ["💪", preview.protein, "g P", "#4ECDC4"], ["🌾", preview.carbs, "g C", "#FFE66D"], ["🥑", preview.fat, "g F", "#A8DADC"]].map(([icon, val, unit, c]) => (
                        <div key={unit} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: c }}>{val}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{unit}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                      TDEE: {preview.tdee} kcal/day · Target: {preview.calories} kcal
                    </div>
                  </div>
                );
              })()}

              <button onClick={() => applyComputedMacros(bodyProfile)}
                disabled={!calculateMacrosFromProfile(bodyProfile)}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                  background: calculateMacrosFromProfile(bodyProfile)
                    ? "linear-gradient(135deg, #4ECDC4, #44A5A0)" : "rgba(255,255,255,0.06)",
                  color: calculateMacrosFromProfile(bodyProfile) ? "#0C0C14" : "rgba(255,255,255,0.2)",
                  fontWeight: 700, fontSize: 14, cursor: calculateMacrosFromProfile(bodyProfile) ? "pointer" : "default",
                  boxShadow: calculateMacrosFromProfile(bodyProfile) ? "0 4px 20px rgba(78,205,196,0.3)" : "none"
                }}>
                {profileSaved ? "✓ Macros Applied — Update" : "Apply These Macros to My Goals"}
              </button>
            </Card>

            {/* Manual override */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Manual Override</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>Fine-tune or set your own targets directly.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[["Calories", "calories", "#FF6B35", "kcal"], ["Protein", "protein", "#4ECDC4", "g"], ["Carbs", "carbs", "#FFE66D", "g"], ["Fat", "fat", "#A8DADC", "g"]].map(([l, k, c, u]) => (
                  <div key={k}>
                    <label style={{ ...labelStyle, color: c }}>{l} ({u})</label>
                    <input type="number" min="0" style={{ ...inputStyle, borderColor: `${c}33` }}
                      value={goalForm[k]} onChange={e => setGoalForm(p => ({ ...p, [k]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <button onClick={saveGoals} style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #FF6B35, #e5521f)", color: "#fff",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(255,107,53,0.25)"
              }}>Save Manual Goals</button>
            </Card>

            {/* Clear all data */}
            <Card style={{ marginTop: 16, borderColor: "rgba(255,80,80,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "rgba(255,255,255,0.7)" }}>🗑 Reset All Data</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 14, lineHeight: 1.6 }}>
                Clears all meals, weight entries, workouts, creatine logs, and goals from this device. This cannot be undone.
              </div>
              <button onClick={() => {
                if (!window.confirm("Are you sure? This will permanently delete all your data.")) return;
                const keys = ["nt_goals","nt_meals","nt_profile","nt_profile_saved","nt_computed_macros","nt_weight_log","nt_weight_unit","nt_weight_goal","nt_workout_log","nt_creatine_log"];
                keys.forEach(k => localStorage.removeItem(k));
                window.location.reload();
              }} style={{
                width: "100%", padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,80,80,0.3)",
                background: "rgba(255,80,80,0.08)", color: "#FF6B6B",
                fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}>Clear All Data</button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
