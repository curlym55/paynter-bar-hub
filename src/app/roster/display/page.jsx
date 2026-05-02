'use client';
import { useState, useEffect, useCallback } from 'react';
import { getVolunteers, getSessionsForMonth, getAnnouncements } from '../../../lib/supabase';

const ROTATE_INTERVAL = 15000;
const REFRESH_INTERVAL = 120000;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function BarDisplay() {
  const [screen, setScreen] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [priceList, setPriceList] = useState({});
  const [allPriceItems, setAllPriceItems] = useState([]);
  const [priceCategories, setPriceCategories] = useState([]);
  const [activePriceCat, setActivePriceCat] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());
  const [paused, setPaused] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const [vols, sess, anns] = await Promise.all([
        getVolunteers(),
        getSessionsForMonth(year, month),
        getAnnouncements()
      ]);
      let allSessions = sess;
      if (now.getDate() > 24) {
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextSess = await getSessionsForMonth(nextYear, nextMonth);
        allSessions = [...sess, ...nextSess];
      }
      setVolunteers(vols);
      setSessions(allSessions);
      setAnnouncements(anns || []);
      setLoading(false);
    } catch (err) {
      console.error('Display load error:', err);
      setLoading(false);
    }
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/items');
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || data || [];
      if (!Array.isArray(items)) return;

      const grouped = {};
      const allItems = [];

      const wineCategories = ['White Wine', 'Red Wine', 'Rose', 'Sparkling'];

      items.forEach(item => {
        const cat = item.category || 'Other';
        const name = item.name || '';
        const isWine = wineCategories.includes(cat);
        let glass = parseFloat(item.sellPrice) || parseFloat(item.squareSellPrice) || 0;
        let bottle = parseFloat(item.sellPriceBottle) || parseFloat(item.squareSellPriceBottle) || 0;

        // For wines: bottle price is usually the "Regular" variation, glass is "Wine Glass" variation
        if (isWine && bottle <= 0 && Array.isArray(item.variations) && item.variations.length > 1) {
          const glassVar = item.variations.find(v => v.name && v.name.toLowerCase().includes('glass'));
          const regularVar = item.variations.find(v => v.name && !v.name.toLowerCase().includes('glass'));
          if (glassVar && regularVar && regularVar.price > glassVar.price) {
            glass = parseFloat(glassVar.price) || glass;
            bottle = parseFloat(regularVar.price) || 0;
          }
        }

        const bottleOnly = item.bottleOnly === true || item.bottleOnly === 'yes';
        if (!name || (glass <= 0 && bottle <= 0)) return;

        const entry = { name, glass: bottleOnly ? 0 : glass, bottle, category: cat };
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(entry);
        allItems.push(entry);
      });

      Object.keys(grouped).forEach(cat => {
        grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
      });
      allItems.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

      const catOrder = { 'Beer': 0, 'Cider': 1, 'PreMix': 2, 'White Wine': 3, 'Red Wine': 4, 'Rose': 5, 'Sparkling': 6, 'Fortified & Liqueurs': 7, 'Spirits': 8, 'Soft Drinks': 9, 'Snacks': 10 };
      const cats = Object.keys(grouped).sort((a, b) => (catOrder[a] ?? 99) - (catOrder[b] ?? 99));

      setPriceCategories(['All', ...cats]);
      setPriceList(grouped);
      setAllPriceItems(allItems);
    } catch (err) {
      console.error('Price list error:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadPrices();
    const refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
    const priceTimer = setInterval(loadPrices, 300000);
    return () => { clearInterval(refreshTimer); clearInterval(priceTimer); };
  }, [loadData, loadPrices]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getTotalScreens = () => {
    let count = 1;
    if (priceCategories.length > 0) count++;
    if (announcements.length > 0) count++;
    count++;
    return count;
  };

  useEffect(() => {
    if (paused) return;
    const totalScreens = getTotalScreens();
    const t = setInterval(() => {
      setScreen(prev => {
        const next = (prev + 1) % totalScreens;
        if (getScreenType(next) === 'prices') {
          setActivePriceCat(prev2 => (prev2 + 1) % Math.max(priceCategories.length, 1));
        }
        return next;
      });
    }, ROTATE_INTERVAL);
    return () => clearInterval(t);
  }, [paused, sessions, announcements, priceCategories]);

  const getScreenType = (idx) => {
    if (idx === 0) return 'roster';
    let next = 1;
    if (priceCategories.length > 0) { if (idx === next) return 'prices'; next++; }
    if (announcements.length > 0) { if (idx === next) return 'notices'; next++; }
    return 'info';
  };

  const handleTap = () => {
    const totalScreens = getTotalScreens();
    setScreen(prev => {
      const next = (prev + 1) % totalScreens;
      if (getScreenType(next) === 'prices') {
        setActivePriceCat(prev2 => (prev2 + 1) % Math.max(priceCategories.length, 1));
      }
      return next;
    });
    setPaused(true);
    setTimeout(() => setPaused(false), 30000);
  };

  const getVolName = (id) => {
    const v = volunteers.find(v => v.id === id);
    return v ? v.name : '';
  };

  const today = new Date(new Date().setHours(0,0,0,0));
  const upcomingSessions = sessions
    .filter(s => s.date >= today)
    .sort((a, b) => a.date - b.date || a.time.localeCompare(b.time));

  const groupedSessions = {};
  upcomingSessions.forEach(s => {
    const key = s.date.toISOString().split('T')[0];
    if (!groupedSessions[key]) groupedSessions[key] = [];
    groupedSessions[key].push(s);
  });
  const sessionDates = Object.keys(groupedSessions).slice(0, 4);

  const formatDate = (d) => `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  const formatClock = (d) => d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatPrice = (p) => p > 0 ? `$${p.toFixed(2)}` : '';

  const bg = "#0a0e27";
  const card = { background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 20px", marginBottom: 12, backdropFilter: "blur(10px)" };
  const accent = { wednesday: "#66BB6A", friday: "#FFB74D", sunday: "#64B5F6", other: "#CE93D8" };

  if (loading) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "white", fontSize: 24, fontWeight: 300 }}>Loading Paynter Bar...</div>
      </div>
    );
  }

  const renderRoster = () => (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "white", marginBottom: 16, textAlign: "center" }}>
        Upcoming Roster
      </div>
      {sessionDates.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 18 }}>No upcoming sessions</div>
      ) : (
        sessionDates.map(dateKey => {
          const daySessions = groupedSessions[dateKey];
          const d = daySessions[0].date;
          const dayColor = accent[daySessions[0].dayType] || accent.other;
          return (
            <div key={dateKey} style={{ ...card, borderLeft: `4px solid ${dayColor}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: dayColor, marginBottom: 8 }}>
                {formatDate(d)}
                {daySessions[0].eventName && <span style={{ fontSize: 14, marginLeft: 10, padding: "2px 10px", background: "rgba(255,255,255,0.1)", borderRadius: 8, color: "white" }}>{daySessions[0].eventName}</span>}
              </div>
              {daySessions.map(s => (
                <div key={s.id} style={{ marginBottom: 8, paddingLeft: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}>{s.time}</span>
                    <span style={{ fontSize: 13, color: s.volunteers.length >= s.needed && s.dutyManager ? "#66BB6A" : "#FFB74D", fontWeight: 600 }}>
                      {s.volunteers.length >= s.needed && s.dutyManager ? "FULL" : `${s.volunteers.length}/${s.needed} volunteers`}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
                    {s.dutyManager && (
                      <span style={{ fontSize: 14, color: "white", background: "rgba(33,150,243,0.3)", padding: "2px 10px", borderRadius: 6 }}>
                        DM: {getVolName(s.dutyManager)}
                      </span>
                    )}
                    {s.volunteers.map(vid => (
                      <span key={vid} style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.08)", padding: "2px 10px", borderRadius: 6 }}>
                        {getVolName(vid)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );

  const renderPriceRow = (item, i, total) => (
    <div key={`${item.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", borderBottom: i < total - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
      <span style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", flex: 1 }}>{item.name}</span>
      <div style={{ display: "flex", gap: 12, alignItems: "center", whiteSpace: "nowrap" }}>
        {item.glass > 0 && (
          <span style={{ fontSize: 16, fontWeight: 700, color: "#66BB6A" }}>{formatPrice(item.glass)}</span>
        )}
        {item.bottle > 0 && (
          <span style={{ fontSize: 14, fontWeight: 600, color: "#FFB74D" }}>
            btl {formatPrice(item.bottle)}
          </span>
        )}
      </div>
    </div>
  );

  const renderPrices = () => {
    const catName = priceCategories[activePriceCat % priceCategories.length] || '';
    const isAll = catName === 'All';
    const items = isAll ? allPriceItems : (priceList[catName] || []);

    // Group items by category for "All" view
    const allGrouped = {};
    if (isAll) {
      items.forEach(item => {
        if (!allGrouped[item.category]) allGrouped[item.category] = [];
        allGrouped[item.category].push(item);
      });
    }

    return (
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "white", marginBottom: 8, textAlign: "center" }}>
          Price List
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
          {priceCategories.map((cat, i) => (
            <button key={cat} onClick={(e) => { e.stopPropagation(); setActivePriceCat(i); }}
              style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer",
                background: i === activePriceCat % priceCategories.length ? "#FFB74D" : "rgba(255,255,255,0.1)",
                color: i === activePriceCat % priceCategories.length ? "#0a0e27" : "rgba(255,255,255,0.6)" }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: isAll ? "65vh" : "auto", overflowY: isAll ? "auto" : "visible" }}>
          {isAll ? (
            Object.keys(allGrouped).map(cat => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFB74D", padding: "8px 4px 4px", textTransform: "uppercase", letterSpacing: 1 }}>{cat}</div>
                <div style={card}>
                  {allGrouped[cat].map((item, i) => renderPriceRow(item, i, allGrouped[cat].length))}
                </div>
              </div>
            ))
          ) : (
            <div style={card}>
              {items.map((item, i) => renderPriceRow(item, i, items.length))}
              {items.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14, padding: 10 }}>No items</div>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
          Prices from Square POS
        </div>
      </div>
    );
  };

  const renderAnnouncements = () => (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "white", marginBottom: 16, textAlign: "center" }}>
        Notices
      </div>
      {announcements.map(a => (
        <div key={a.id} style={{ ...card, borderLeft: "4px solid #FFB74D" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FFB74D", marginBottom: 6 }}>{a.title}</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.content}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
            {new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderInfo = () => (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "white", marginBottom: 16, textAlign: "center" }}>
        Paynter Bar
      </div>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#66BB6A", marginBottom: 12 }}>Opening Hours</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 20px" }}>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }}>Wednesday</span>
            <span style={{ fontSize: 18, color: "#66BB6A", fontWeight: 600 }}>5:00 - 7:00 PM</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 20px" }}>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }}>Friday</span>
            <span style={{ fontSize: 18, color: "#FFB74D", fontWeight: 600 }}>5:00 - 7:00 PM</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 20px" }}>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }}>Sunday</span>
            <span style={{ fontSize: 18, color: "#64B5F6", fontWeight: 600 }}>5:00 - 7:00 PM</span>
          </div>
        </div>
      </div>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#64B5F6", marginBottom: 12 }}>Special Events</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)" }}>Trivia Night — Last Wednesday of the month</div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)" }}>Bingo — Third Wednesday of the month</div>
        </div>
      </div>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
          Staffed by volunteers from the GemLife Palmwoods community
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
          paynterbar@gemwoods.com.au
        </div>
      </div>
    </div>
  );

  const totalScreens = getTotalScreens();
  const screenType = getScreenType(screen);
  let currentScreen;
  if (screenType === 'roster') currentScreen = renderRoster();
  else if (screenType === 'prices') currentScreen = renderPrices();
  else if (screenType === 'notices') currentScreen = renderAnnouncements();
  else currentScreen = renderInfo();

  return (
    <div
      style={{ background: bg, minHeight: "100vh", padding: "16px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", cursor: "pointer", overflow: "hidden" }}
      onClick={handleTap}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
          {formatDate(clock)}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>
          {formatClock(clock)}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {currentScreen}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
        {Array.from({ length: totalScreens }).map((_, i) => (
          <div key={i} style={{
            width: screen === i ? 24 : 8, height: 8,
            borderRadius: 4,
            background: screen === i ? "white" : "rgba(255,255,255,0.2)",
            transition: "all 0.3s"
          }} />
        ))}
      </div>

      {paused && (
        <div style={{ position: "fixed", top: 10, right: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", padding: "2px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
          Paused
        </div>
      )}
    </div>
  );
}
