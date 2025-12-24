# What's Next: Implementation Roadmap

## ✅ Current Status

**Phase 1:** ✅ COMPLETE - Real-Time Leaderboards & Presence  
**Phase 2:** ✅ COMPLETE - Multiplayer v1 (Room Management & UI)

---

## 🎯 Immediate Next Steps (Priority Order)

### 1. **Test Phase 2 Implementation** ⚡ HIGH PRIORITY

**What to Test:**
- [ ] Click "Multiplayer" button in game header
- [ ] Create a room (should get room code)
- [ ] Join a room with room code
- [ ] Verify player list displays correctly
- [ ] Test leaving a room
- [ ] Test host controls (start game button)

**Expected Behavior:**
- Room creation/joining works via API
- UI renders correctly
- Error handling works
- Styling matches site aesthetic

**Time:** 30-60 minutes

---

### 2. **Deploy WebSocket Server** 🚀 HIGH PRIORITY

**What's Needed:**
- Deploy `websocket-server/` to Railway or Render
- Configure Redis connection
- Set environment variables
- Test WebSocket connection

**Steps:**
1. **Choose Platform:**
   - Railway (recommended - easy setup)
   - Render (good alternative)
   - Fly.io (if you prefer)

2. **Deploy:**
   ```bash
   cd websocket-server
   # Follow websocket-server/README.md
   ```

3. **Configure:**
   - Set `REDIS_URL` environment variable
   - Set `PORT` (usually auto-set by platform)
   - Optionally set `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN`

4. **Update Site:**
   - Add WebSocket URL to site config:
   ```javascript
   window.NOTEWORTHY_CONFIG = {
     websocketUrl: 'wss://your-server.railway.app'
   };
   ```

**Time:** 1-2 hours

---

### 3. **Test Full Multiplayer Flow** 🎮 MEDIUM PRIORITY

**What to Test:**
- [ ] WebSocket connects successfully
- [ ] Real-time player updates (join/leave)
- [ ] Host can start game
- [ ] Questions synchronized across players
- [ ] Answers submitted and validated
- [ ] Results broadcast correctly
- [ ] Score calculation accurate
- [ ] Disconnect handling works

**Test Scenarios:**
1. **2 Players:**
   - Create room, join with second browser
   - Start game, verify synchronization
   - Submit answers, verify results

2. **Multiple Players (3-8):**
   - Test with maximum players
   - Verify all see same question
   - Test answer timing

3. **Edge Cases:**
   - Player disconnects mid-game
   - Late join (after game started)
   - Network interruption

**Time:** 2-4 hours

---

## 📋 Phase 3: Collaborative Fact-Checking (Future)

**When to Start:** After Phase 2 is proven and stable

### Overview
Multiple users reviewing the same claim/article with:
- Agreement/disagreement indicators
- Evidence linking (sources cited, confidence level)
- Real-time updates when consensus shifts
- Think: Wikipedia + OSINT + newsroom verification

### Key Features:
1. **Review Submission System**
   - Users submit verdicts (factual/misleading)
   - Confidence levels
   - Evidence citations

2. **Consensus Calculation**
   - Weighted consensus based on user credibility
   - Confidence aggregation
   - Disagreement indicators

3. **Evidence Linking**
   - Source citations
   - Cross-references
   - Verification chains

4. **Real-Time Updates**
   - Live consensus changes
   - New evidence notifications
   - Disagreement alerts

**Timeline:** 3-4 weeks (after Phase 2 proven)

---

## 🔧 Infrastructure Setup (If Not Done)

### Required Services:

1. **Redis** (for real-time state)
   - Upstash (recommended - serverless)
   - Redis Cloud
   - Self-hosted

2. **PostgreSQL** (for persistence - optional for Phase 2)
   - Supabase (recommended)
   - Neon
   - Railway

3. **WebSocket Server Hosting**
   - Railway (easiest)
   - Render
   - Fly.io

### Environment Variables Needed:

**Netlify:**
- `NETLIFY_SITE_ID`
- `NETLIFY_BLOB_READ_WRITE_TOKEN`
- `REDIS_URL` (for broadcast function)
- `WEBSOCKET_URL` (for client connection)

**WebSocket Server:**
- `REDIS_URL`
- `PORT` (auto-set by platform)
- `NETLIFY_SITE_ID` (optional)
- `NETLIFY_BLOB_READ_WRITE_TOKEN` (optional)

---

## 📊 Recommended Timeline

### Week 1: Testing & Deployment
- **Day 1-2:** Test Phase 2 room management
- **Day 3-4:** Deploy WebSocket server
- **Day 5:** Test full multiplayer flow

### Week 2: Refinement
- Fix any issues found
- Performance optimization
- User experience improvements
- Documentation updates

### Week 3+: Phase 3 (If Phase 2 Successful)
- Start collaborative fact-checking
- Build review system
- Implement consensus calculation

---

## 🎯 Success Criteria

### Phase 2 Complete When:
- ✅ Room management works reliably
- ✅ WebSocket server deployed and stable
- ✅ Full multiplayer tested with 2-8 players
- ✅ No critical bugs
- ✅ Performance acceptable

### Ready for Phase 3 When:
- ✅ Phase 2 stable in production
- ✅ User feedback positive
- ✅ No critical issues
- ✅ Infrastructure proven

---

## 💡 Quick Wins (Optional)

While testing Phase 2, consider:

1. **Expand Question Pool**
   - Add more questions to `game-questions.js`
   - Load from same source as `script.js`

2. **Improve Error Messages**
   - More user-friendly error handling
   - Better connection status indicators

3. **Add Analytics**
   - Track room creation/joining
   - Monitor WebSocket connections
   - Measure game completion rates

---

## 🚨 Blockers to Address

1. **WebSocket Server Deployment**
   - Must deploy before full multiplayer works
   - Can test room management without it

2. **Redis Configuration**
   - Needed for real-time features
   - Can use Upstash free tier

3. **Question Pool**
   - Currently minimal (5 questions)
   - Should expand for production

---

## 📝 Next Action Items

**Immediate (This Week):**
1. [ ] Test multiplayer button and room creation
2. [ ] Deploy WebSocket server to Railway
3. [ ] Configure Redis connection
4. [ ] Test with 2 players

**Short-term (Next 2 Weeks):**
1. [ ] Full multiplayer testing
2. [ ] Bug fixes and refinements
3. [ ] Expand question pool
4. [ ] Performance optimization

**Long-term (After Phase 2 Proven):**
1. [ ] Start Phase 3 planning
2. [ ] Design collaborative fact-checking UI
3. [ ] Build review submission system

---

**Status:** Ready to test Phase 2 and deploy WebSocket server  
**Next Milestone:** Full multiplayer working end-to-end  
**Timeline:** 1-2 weeks to production-ready Phase 2

