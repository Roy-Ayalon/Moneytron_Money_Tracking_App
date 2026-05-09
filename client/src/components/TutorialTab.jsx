import React from 'react';
import { BookOpen } from 'lucide-react';

export default function TutorialTab(){
  const [lightboxImg, setLightboxImg] = React.useState(null);
  const [activeSection, setActiveSection] = React.useState('welcome');

  function Screenshot({src, alt, caption}) {
    return (
      <div style={{textAlign:'center',margin:'16px 0'}}>
        <img
          src={src} alt={alt}
          style={{maxWidth:'100%',borderRadius:14,boxShadow:'0 8px 28px rgba(30,20,70,.18)',cursor:'pointer',transition:'transform .15s',border:'2px solid #e0ddf5'}}
          onClick={()=>setLightboxImg(src)}
          onMouseOver={e=>e.target.style.transform='scale(1.02)'}
          onMouseOut={e=>e.target.style.transform='scale(1)'}
        />
        {caption && <div style={{marginTop:8,fontSize:13,color:'#667085',fontStyle:'italic'}}>{caption}</div>}
      </div>
    );
  }

  function VideoClip({src, caption}) {
    return (
      <div style={{textAlign:'center',margin:'18px 0'}}>
        <video src={src} controls playsInline style={{maxWidth:'100%',borderRadius:14,boxShadow:'0 8px 28px rgba(30,20,70,.18)',border:'2px solid #e0ddf5',background:'#000'}}/>
        {caption && <div style={{marginTop:8,fontSize:13,color:'#667085',fontStyle:'italic'}}>🎬 {caption}</div>}
      </div>
    );
  }

  function StepCard({number, title, children}) {
    return (
      <div style={{display:'flex',gap:16,margin:'18px 0',padding:16,background:'#faf9ff',borderRadius:14,border:'1px solid #e0ddf5'}}>
        <div style={{minWidth:40,height:40,borderRadius:'50%',background:'linear-gradient(180deg,#7c3aed,#5b21b6)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18,flexShrink:0}}>{number}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:16,color:'#2c2761',marginBottom:4}}>{title}</div>
          <div style={{fontSize:14,color:'#4a4d6b',lineHeight:1.6}}>{children}</div>
        </div>
      </div>
    );
  }

  const sections = [
    {id:'welcome',    icon:'🎉', label:'Welcome'},
    {id:'tips',       icon:'💡', label:'Tips & Info'},
    {id:'quickstart', icon:'🚀', label:'Quick Start'},
    {id:'login',      icon:'🔐', label:'Sign Up & Login'},
    {id:'transactions',icon:'💰', label:'Transactions'},
    {id:'summary',    icon:'📊', label:'Summary'},
    {id:'statistics', icon:'📈', label:'Statistics'},
    {id:'data',       icon:'📄', label:'Data'},
    {id:'categories', icon:'📚', label:'Categories'},
  ];

  function WelcomeSection() {
    return (
      <div>
        <div style={{textAlign:'center',margin:'20px 0 30px'}}>
          <div style={{fontSize:64,marginBottom:12}}>🎉</div>
          <h2 style={{color:'#2c2761',margin:'0 0 8px',fontSize:28}}>Welcome to MoneyTron!</h2>
          <p style={{color:'#667085',fontSize:16,maxWidth:600,margin:'0 auto',lineHeight:1.7}}>Your personal multi-user money tracking app. This guide will walk you through everything you need to know to manage your finances like a pro.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,margin:'24px 0'}}>
          {[{icon:'💰',title:'Track Transactions',desc:'Upload bank files or add transactions manually'},{icon:'📊',title:'Visual Summary',desc:'Charts and graphs of your spending patterns'},{icon:'📈',title:'Deep Statistics',desc:'Filter, compare, and analyze across months'},{icon:'📄',title:'Full Data Access',desc:'View, edit, and manage all historical data'},{icon:'📚',title:'Smart Categories',desc:'Organize spending into categories & subcategories'},{icon:'🔐',title:'Multi-User',desc:'Each user has their own secure data'}].map((f,i)=>(
            <div key={i} style={{background:'#fff',borderRadius:16,padding:18,textAlign:'center',boxShadow:'0 4px 16px rgba(16,24,40,.06)',border:'1px solid #f0eeff'}}>
              <div style={{fontSize:32,marginBottom:8}}>{f.icon}</div>
              <div style={{fontWeight:700,color:'#2c2761',marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:13,color:'#667085'}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function TipsSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 18px',fontSize:22}}>💡 Tips & Good to Know</h2>
        <div style={{display:'grid',gap:14}}>
          {[
            {icon:'🏷️',title:'Tag Format',desc:'Tags follow the format "Month/Year" (e.g., 1/26 = January 2026). They group transactions by period.'},
            {icon:'💱',title:'Currency Toggle',desc:'Click the currency button (₪/$) next to any amount to switch between your enabled currencies (ILS, USD, EUR, GBP). Configure which currencies are available in Settings.'},
            {icon:'🚩',title:'VI Flag',desc:'Mark transactions as "VI" (Verify/Investigate) to flag suspicious or unusual entries for review. These rows show in red.'},
            {icon:'🪄',title:'Auto-Categorize',desc:'When you upload a file, MoneyTron automatically categorizes transactions based on your past data and patterns. The more you use the app, the smarter it gets.'},
            {icon:'📤',title:'File Formats',desc:'Upload Excel (.xlsx) or CSV files. The parser supports common Israeli bank formats (Leumi, Hapoalim, Max, Cal, etc.).'},
            {icon:'🔗',title:'Cross-Tab Navigation',desc:'Double-click cells in the Summary comparison table to jump directly to filtered Data view for that category/month.'},
            {icon:'💾',title:'Auto-Save',desc:'The Transactions tab auto-saves your staged data when you switch tabs. The Data tab warns you about unsaved changes before leaving.'},
            {icon:'📅',title:'Date Formats',desc:'Dates are displayed as DD-MM-YYYY everywhere. You can type dates in various formats and the app normalizes them automatically.'},
          ].map((tip,i)=>(
            <div key={i} style={{display:'flex',gap:14,padding:16,background:'#faf9ff',borderRadius:14,border:'1px solid #e0ddf5'}}>
              <div style={{fontSize:28,flexShrink:0}}>{tip.icon}</div>
              <div>
                <div style={{fontWeight:700,color:'#2c2761',marginBottom:2}}>{tip.title}</div>
                <div style={{fontSize:14,color:'#4a4d6b',lineHeight:1.6}}>{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'#f0f9ff',borderRadius:16,padding:24,margin:'24px 0',border:'1.5px solid #bae6fd'}}>
          <div style={{fontWeight:800,color:'#0c4a6e',marginBottom:8,fontSize:20}}>💡 Expense vs. Income - When to Use What</div>
          <p style={{color:'#334155',fontSize:14,margin:'0 0 14px',lineHeight:1.6}}>Every transaction in MoneyTron is either an <strong>Expense</strong> or <strong>Income</strong>. Here's how to decide:</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}>
            <div style={{background:'#fee2e2',borderRadius:12,padding:16}}>
              <div style={{fontWeight:800,color:'#991b1b',fontSize:16,marginBottom:6}}>🔴 Expense</div>
              <p style={{color:'#7f1d1d',fontSize:13,lineHeight:1.6,margin:0}}>Money going <strong>out</strong> of your account. Use for purchases, bills, subscriptions, rent, groceries, fuel, etc.</p>
              <div style={{marginTop:8,fontSize:12,color:'#991b1b'}}>Examples: Supermarket, Electric bill, Restaurant, Netflix</div>
            </div>
            <div style={{background:'#dcfce7',borderRadius:12,padding:16}}>
              <div style={{fontWeight:800,color:'#065f46',fontSize:16,marginBottom:6}}>🟢 Income</div>
              <p style={{color:'#14532d',fontSize:13,lineHeight:1.6,margin:0}}>Money coming <strong>in</strong> to your account. Use for salary, freelance payments, refunds, transfers received, etc.</p>
              <div style={{marginTop:8,fontSize:12,color:'#065f46'}}>Examples: Monthly salary, Tax refund, Side job payment</div>
            </div>
          </div>
          <div style={{background:'#fff',borderRadius:10,padding:12,border:'1px solid #e2e8f0'}}>
            <p style={{margin:0,fontSize:13,color:'#475569',lineHeight:1.6}}>
              <strong>How it works:</strong> When you upload a bank file, MoneyTron auto-detects the type based on the sign of the amount. You can always manually toggle a transaction between Expense and Income by clicking the type button in the table. In the <strong>Summary</strong> tab, income appears in green and expenses in red. The "Net" row shows Income minus Expenses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function QuickStartSection() {
    return (
      <div>
        <div style={{background:'linear-gradient(135deg,#ede9fe,#f5f3ff)',borderRadius:16,padding:24,border:'2px solid #ddd6fe'}}>
          <div style={{fontWeight:800,color:'#5b21b6',marginBottom:8,fontSize:20}}>🚀 Quick Startup - First Time Users</div>
          <p style={{color:'#4a4d6b',fontSize:14,margin:'0 0 14px',lineHeight:1.6}}>New to MoneyTron? Follow these steps to get up and running in minutes:</p>
          <ol style={{margin:0,paddingLeft:20,color:'#4a4d6b',lineHeight:2.2,fontSize:14}}>
            <li><strong>Create your account</strong> - Click "Sign Up" and enter a username, password, and your email address.</li>
            <li><strong>Set up categories</strong> - Go to the <strong>Categories</strong> tab and add spending categories (e.g., Food, Transport, Bills) with subcategories (e.g., Groceries, Restaurants under Food).</li>
            <li><strong>Upload your first file</strong> - In the <strong>Transactions</strong> tab, click "Upload" and select a bank statement file (.xlsx or .csv). Pick the correct month and year.</li>
            <li><strong>Review & categorize</strong> - MoneyTron auto-categorizes transactions based on patterns. Review the results, fix any that need adjustment, and fill in missing categories.</li>
            <li><strong>Save to past data</strong> - Click "Save All" to commit your transactions. They'll now appear in Summary and Statistics.</li>
            <li><strong>Explore your data</strong> - Check the <strong>Summary</strong> tab for charts and the <strong>Statistics</strong> tab for deeper analysis.</li>
            <li><strong>Repeat monthly</strong> - Each month, upload your new bank statement and save. MoneyTron gets smarter over time!</li>
          </ol>
        </div>
      </div>
    );
  }

  function LoginSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>🔐 Sign Up & Login</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7}}>MoneyTron supports multiple users. Each user has their own categories, transactions, and settings - completely separate and private.</p>
        <StepCard number={1} title="Create Your Account">
          Click <strong>"Sign Up"</strong> on the login page. Enter a username, password, and your email address. Your data is stored locally on the server.
        </StepCard>
        <StepCard number={2} title="Login">
          Enter your username and password. You'll land on the <strong>Transactions</strong> tab - your home base for adding new data.
        </StepCard>
        <StepCard number={3} title="Switch Users">
          Click <strong>"Switch User"</strong> in the top bar to log out and let another user sign in.
        </StepCard>
        <StepCard number={4} title="Change Password">
          Click the <strong>"🔒 Change Password"</strong> button in the top bar to update your password at any time.
        </StepCard>
        <VideoClip src="/videos/Sign%20up.mov" caption="How to sign up for MoneyTron"/>
        <VideoClip src="/videos/change%20password.mov" caption="How to change your password"/>
      </div>
    );
  }

  function TransactionsSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>💰 Transactions Tab</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7,marginBottom:16}}>This is where you add new transactions - either by uploading a bank file or adding them manually. Think of it as your "staging area" before saving to permanent records.</p>
        <StepCard number={1} title="Upload a Bank File">
          Click <strong>"📁 Upload"</strong> and select an Excel (.xlsx) or CSV file from your bank. Choose the correct <strong>month tag</strong> and <strong>year</strong> in the popup, then confirm. The app will automatically parse and <strong>auto-categorize</strong> your transactions based on your past data.
        </StepCard>
        <StepCard number={2} title="Add Manually">
          Click <strong>"+ Add Manual Row"</strong> to create a new transaction. Fill in the date, name, amount, type (Expense/Income), category, and notes.
        </StepCard>
        <StepCard number={3} title="Edit Inline">
          Click any cell to edit it directly. Change amounts, dates, categories, notes - everything is editable in the table.
        </StepCard>
        <StepCard number={4} title="Save to Past Data">
          When you're happy with your transactions, click <strong>"💾 Save All"</strong> to permanently store them. They'll then appear in Summary and Statistics.
        </StepCard>
        <Screenshot src="/screenshots/transactions%20page.png" alt="Transactions Tab" caption="The transactions staging area with upload and editing"/>
        <VideoClip src="/videos/upload%20transactions.mov" caption="How to upload and categorize transactions"/>
      </div>
    );
  }

  function SummarySection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>📊 Summary Tab</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7,marginBottom:16}}>A visual overview of your financial data. See where your money goes at a glance with interactive charts.</p>
        <StepCard number={1} title="Comparison Table">
          A detailed cross-month table showing every category's spending per month. Expand any category to see subcategory breakdowns.
        </StepCard>
        <StepCard number={2} title="Drill Down">
          <strong>Double-click</strong> any category cell in the comparison table to jump to the <strong>Data tab</strong> filtered to that specific category and month.
        </StepCard>
        <StepCard number={3} title="Monthly Overview">
          Navigate between 6-month windows with <strong>Previous / Next</strong> arrows, or click <strong>Latest</strong> to jump to the most recent months.
        </StepCard>
        <StepCard number={4} title="Bar Charts">
          <strong>Monthly Outcome</strong> shows expenses per month. <strong>Monthly Net</strong> shows income minus expenses - green for surplus, red for deficit.
        </StepCard>
        <StepCard number={5} title="Pie Charts">
          See spending breakdowns by <strong>category</strong> and <strong>subcategory</strong>. Hover over slices for details and percentages.
        </StepCard>
        <Screenshot src="/screenshots/summary%20page.png" alt="Summary Charts" caption="Summary charts - bar charts and KPIs"/>
        <VideoClip src="/videos/summary%20double%20click.mov" caption="Double-click drill-down from Summary to Data"/>
      </div>
    );
  }

  function StatisticsSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>📈 Statistics Tab</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7,marginBottom:16}}>Deep-dive analytics with powerful filters. Analyze your spending patterns over any time period.</p>
        <StepCard number={1} title="Set Your Filters">
          Use the filter panel to select <strong>years</strong>, <strong>months</strong>, <strong>type</strong> (Expense/Income), <strong>categories</strong>, and <strong>subcategories</strong>. Use quick-select buttons: Last 3 Months, Last 6 Months, or All Time.
        </StepCard>
        <StepCard number={2} title="View Statistics">
          Click <strong>"📊 Calculate Statistics"</strong> to generate results. You'll see Mean, Median, Min, Max monthly totals plus a full breakdown.
        </StepCard>
        <StepCard number={3} title="Category Breakdown">
          View per-category analysis with <strong>pie charts</strong> and detailed tables showing how each category contributes to your total.
        </StepCard>
        <Screenshot src="/screenshots/statistic%20page.png" alt="Statistics Tab" caption="Statistics tab with filters and analytics"/>
        <VideoClip src="/videos/statistics%20demo.mov" caption="Statistics tab demo - filtering and analyzing data"/>
      </div>
    );
  }

  function DataSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>📄 Data Tab</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7,marginBottom:16}}>View and edit all your saved historical transactions. This is your permanent record, with powerful filtering.</p>
        <StepCard number={1} title="Browse Your Data">
          All saved transactions appear here sorted by date. Use the column filters (Tag, Name, Category, Subcategory) to narrow down what you see.
        </StepCard>
        <StepCard number={2} title="Edit Transactions">
          Click any cell to edit. Changes are tracked - you'll see an <strong>unsaved changes warning</strong> if you try to leave without saving.
        </StepCard>
        <StepCard number={3} title="Save Changes">
          Click <strong>"💾 Save Changes"</strong> to persist your edits. A confirmation dialog shows exactly what changed before you confirm.
        </StepCard>
        <StepCard number={4} title="Cross-Tab Navigation">
          When you double-click a cell in the Summary comparison table, you'll arrive here pre-filtered to that category/month.
        </StepCard>
        <Screenshot src="/screenshots/data%20page.png" alt="Data Tab" caption="The data tab showing all saved transactions"/>
      </div>
    );
  }

  function CategoriesSection() {
    return (
      <div>
        <h2 style={{color:'#2c2761',margin:'0 0 12px',fontSize:22}}>📚 Categories Tab</h2>
        <p style={{color:'#4a4d6b',lineHeight:1.7,marginBottom:16}}>Organize your transactions into meaningful categories and subcategories for better tracking and analysis.</p>
        <StepCard number={1} title="Add a Category">
          Type a category name (e.g., "Food", "Transport", "Entertainment") in the input and click <strong>"Add"</strong>.
        </StepCard>
        <StepCard number={2} title="Add Subcategories">
          Within each category card, add subcategories (e.g., under "Food": "Groceries", "Restaurants", "Coffee"). This helps with detailed tracking.
        </StepCard>
        <StepCard number={3} title="Search & Manage">
          Use the search bar to find categories or subcategories quickly. Delete any category or subcategory you no longer need.
        </StepCard>
        <Screenshot src="/screenshots/catagory%20page.png" alt="Categories Tab" caption="Category management with subcategories"/>
        <VideoClip src="/videos/Add%20catagory.mov" caption="How to add categories and subcategories"/>
      </div>
    );
  }

  const sectionContent = {
    welcome: WelcomeSection,
    tips: TipsSection,
    quickstart: QuickStartSection,
    login: LoginSection,
    transactions: TransactionsSection,
    summary: SummarySection,
    statistics: StatisticsSection,
    data: DataSection,
    categories: CategoriesSection,
  };

  const ActiveContent = sectionContent[activeSection] || WelcomeSection;

  return (
    <div>
      <div className="section-title"><BookOpen size={20}/>MoneyTron Tutorial &amp; Guide</div>
      <div className="section-sub">Everything you need to know to get started</div>
      <div className="thin-underline"></div>
      {lightboxImg && (
        <div className="modal-overlay" onClick={()=>setLightboxImg(null)} style={{zIndex:10000,cursor:'zoom-out'}}>
          <img src={lightboxImg} style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:16,boxShadow:'0 24px 64px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setLightboxImg(null)} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,.9)',border:'none',borderRadius:'50%',width:40,height:40,fontSize:20,fontWeight:800,cursor:'pointer',boxShadow:'0 4px 12px rgba(0,0,0,.3)'}}>✕</button>
        </div>
      )}
      <div style={{display:'flex',gap:0,minHeight:500}}>
        <nav style={{width:200,minWidth:200,background:'#faf9ff',borderRadius:'16px 0 0 16px',border:'1px solid #e0ddf5',borderRight:'none',padding:'12px 0',display:'flex',flexDirection:'column',gap:2}}>
          {sections.map(s=>(
            <button
              key={s.id}
              onClick={()=>setActiveSection(s.id)}
              style={{
                display:'flex',alignItems:'center',gap:10,
                padding:'11px 16px',margin:'0 8px',
                background: activeSection===s.id ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'transparent',
                color: activeSection===s.id ? '#fff' : '#4a4d6b',
                border:'none',borderRadius:10,cursor:'pointer',
                fontSize:13.5,fontWeight: activeSection===s.id ? 700 : 500,
                textAlign:'left',
                transition:'all .15s ease',
              }}
              onMouseOver={e=>{ if(activeSection!==s.id) e.currentTarget.style.background='#ede9fe'; }}
              onMouseOut={e=>{ if(activeSection!==s.id) e.currentTarget.style.background='transparent'; }}
            >
              <span style={{fontSize:18}}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="panel" style={{flex:1,borderRadius:'0 16px 16px 0',margin:0,borderLeft:'none',overflow:'auto',maxHeight:'calc(100vh - 240px)'}}>
          <ActiveContent/>
        </div>
      </div>
    </div>
  );
}
