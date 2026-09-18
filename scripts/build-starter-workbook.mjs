import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const repo = path.resolve(process.argv[2] || process.cwd());
const out = path.resolve(process.argv[3] || path.join(repo, 'outputs/starter-kit'));
const prompts = JSON.parse(await fs.readFile(path.join(repo, 'content/starter-prompts.json'), 'utf8'));
await fs.mkdir(out, { recursive: true });
const w = Workbook.create();
const instructions = w.worksheets.add('Instructions');
const intake = w.worksheets.add('Intake');
const results = w.worksheets.add('Results');
const colors = {ink:'#171D25', green:'#18864E', mint:'#E9F8EF', muted:'#596572', input:'#FFF8DF', line:'#D9E1E6'};
for (const s of [instructions,intake,results]) {
  s.showGridLines = false;
  s.getRange(s === instructions ? 'A1:F47' : 'A1:AB106').format.font = {name:'Arial',size:11,color:colors.ink};
  s.getRange(s === instructions ? 'A1:F47' : 'A1:AB106').format.rowHeight = 25;
}
instructions.tabColor=colors.ink;
intake.tabColor=colors.green;
results.tabColor=colors.muted;
instructions.getRange('A1:A47').format.columnWidth = 3;
instructions.getRange('B1:F47').format.columnWidth = 22;
function text(s, range, value, height=30, opts={}) {
  s.mergeCells(range);
  const r=s.getRange(range); r.values=[[value]];
  r.format.wrapText=true; r.format.verticalAlignment='center';
  r.format.rowHeight=height;
  if(opts.fill) r.format.fill=opts.fill;
  if(opts.bold) r.format.font.bold=true;
  if(opts.size) r.format.font.size=opts.size;
  if(opts.color) r.format.font.color=opts.color;
}
text(instructions,'B2:F2','WARP  /  FREIGHT STARTER KIT',34,{bold:true,size:17});
text(instructions,'B4:F4','01  Add your pickup locations below. Fill one Intake row per shipment.',30,{bold:true});
text(instructions,'B5:F5','02  Save the file and attach it to your AI assistant with Warp connected.',30,{bold:true});
text(instructions,'B6:F6','03  Copy the prompt below. Review the returned Results before taking action.',30,{bold:true});
text(instructions,'B8:F8','COPY THIS PROMPT WITH YOUR COMPLETED WORKBOOK',26,{bold:true,color:colors.green});
const paras=prompts[0].prompt.split('\n\n');
text(instructions,'B9:F9',paras[0],95,{fill:colors.mint});
text(instructions,'B10:F10',paras[1],90,{fill:colors.mint});
text(instructions,'B11:F11',paras[2],110,{fill:colors.mint});
text(instructions,'B13:F13','WHAT TO FILL IN',26,{bold:true,color:colors.green});
text(instructions,'B14:F14','Required: shipment ID, Ship From, destination ZIP, pickup date, preference, pallets, weight per pallet, length, width, height and commodity. Use real dates (YYYY-MM-DD), lb and inches.',47);
text(instructions,'B15:F15','Choose Yes, No or Unknown for services, stacking and hazmat. Unknown or blank requires clarification. List any pickup services, delivery deadline, mixed pallet sizes or other constraints in the notes.',47);
text(instructions,'B16:F16','Same-size pallets only in a row. For mixed loads, attach a per-pallet breakdown and ask the assistant to confirm the supported quote path. No assumed dimensions, freight class or date changes.',47);
text(instructions,'B17:F17','US domestic, ambient freight. Flag hazardous or temperature-controlled goods for review; this kit does not establish acceptance. A quote is not a confirmed appointment or a guaranteed delivery.',47);
text(instructions,'B19:F19','EXAMPLE ONLY, NOT A SHIPMENT TO QUOTE',26,{bold:true,color:colors.green});
text(instructions,'B20:F20','EXAMPLE-01 | your saved warehouse | 92101 | your future pickup date | Compare all | 2 pallets | 500 lb each | 48 x 40 x 48 in | boxed apparel | non-stackable | dock to dock',52,{fill:'#F1F4F6'});
text(instructions,'B22:F22','MORE TASKS: INVOICES, COST OPPORTUNITIES AND SERVICE',26,{bold:true,color:colors.green});
text(instructions,'B23:F23','https://mcp.wearewarp.com/starter-kit',28,{color:colors.green});
text(instructions,'B24:F24','Attach invoices with original quotes and delivery records for cost/service reviews. Historical invoices versus new quotes show opportunities, not realized savings. The Results tab starts empty; your assistant supplies evidence.',47);
text(instructions,'B26:F26','YOUR PICKUP LOCATIONS  /  FILL THESE ONCE',28,{bold:true,color:colors.green});
text(instructions,'B27:F27','Use unique names and confirm each actual facility ZIP. The Intake Ship From menu reads the names below. Yellow cells are yours to edit. No company locations are prefilled.',46);
instructions.getRange('B28:F28').values=[['Location name','Origin ZIP','Street address','City','State']];
instructions.getRange('B28:F28').format={fill:colors.ink,font:{bold:true,color:'#FFFFFF'},rowHeight:32};
instructions.getRange('B29:F38').format.fill=colors.input;
instructions.getRange('C29:C38').setNumberFormat('@');
text(instructions,'B40:F40','QUOTE ONLY. This workbook never sends a request by itself and contains no macros. Your AI assistant runs the work after you attach it and send the prompt.',46,{color:colors.muted});
text(instructions,'B42:F42','Results may be returned as a table or CSV if your assistant cannot edit Excel. Keep the original inputs and source references with every review.',42,{color:colors.muted});

const inputHeaders=['Shipment ID','Ship From','Ship To company','Ship To street','Ship To city','Ship To state','Ship To ZIP','Pickup date','Preference','Pallets','Weight / pallet (lb)','Length (in)','Width (in)','Height (in)','Commodity','Freight class if known','Stackable','Delivery appointment','Delivery liftgate','Residential delivery','Hazmat','Pickup services / site needs','Delivery deadline / window','Other delivery needs / notes'];
const resultHeaders=['Shipment ID','Option / status','Mode','Carrier / provider','Total USD','Included charges','Excluded / unknown charges','Estimated transit','Estimated delivery','Quote reference','Quote expiry as returned','Recommended?','Reason / service tradeoff','Missing / confirm','Source / retrieved at','Baseline USD','Baseline source / date','Comparison status','Quoted difference USD','Quoted difference %','Service evidence'];
function tableSheet(s,headers,title,note,rows) {
  const last=String.fromCharCode(64+headers.length);
  text(s,`A2:H2`,title,34,{bold:true,size:17});
  text(s,`A3:L3`,note,42,{color:colors.muted});
  s.getRange(`A6:${last}6`).values=[headers];
  s.getRange(`A6:${last}6`).format={fill:colors.ink,font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:48,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
  s.getRange(`A7:${last}${rows+6}`).format={rowHeight:30,fill:s===intake?colors.input:'#F7F9FA',verticalAlignment:'center'};
  s.getRange(`A6:${last}${rows+6}`).format.columnWidth=20;
  s.getRange(`A6:A${rows+6}`).format.columnWidth=19;
  s.freezePanes.freezeRows(6); s.freezePanes.freezeColumns(2);
  s.tables.add(`A6:${last}${rows+6}`,true,s===intake?'ShipmentIntake':'FreightResults');
}
tableSheet(intake,inputHeaders,'YOUR SHIPMENTS','50 rows. Add pickup locations in Instructions first. Fill known facts; use Unknown where needed. No real shipments or quotes are prefilled.',50);
tableSheet(results,resultHeaders,'YOUR OPTIONS AND FINDINGS','Agent output only. One row per option or blocked shipment. Empty amounts mean unknown, not zero. Invoice reviews may use a separate evidence table.',100);
intake.getRange('C6:E56').format.columnWidth=26;
intake.getRange('O6:P56').format.columnWidth=26;
intake.getRange('V6:X56').format.columnWidth=38;
results.getRange('F6:G106').format.columnWidth=30;
results.getRange('M6:O106').format.columnWidth=34;
results.getRange('Q6:R106').format.columnWidth=30;
results.getRange('U6:U106').format.columnWidth=34;
intake.getRange('G7:G56').setNumberFormat('@');
intake.getRange('H7:H56').setNumberFormat('yyyy-mm-dd');
intake.getRange('J7:N56').setNumberFormat('0.##');
results.getRange('E7:E106').setNumberFormat('$#,##0.00');
results.getRange('P7:P106').setNumberFormat('$#,##0.00');
results.getRange('S7:S106').setNumberFormat('$#,##0.00;[Red]($#,##0.00)');
results.getRange('T7:T106').setNumberFormat('0.0%;[Red](0.0%)');

const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
const stop=(rule,message)=>({allowBlank:true,rule,errorAlert:{style:'stop',title:'Check this value',message}});
const list=(s,r,values)=>{s.getRange(r).dataValidation=stop({type:'list',values},'Choose a value from the menu.');};
list(instructions,'F29:F38',states); list(intake,'F7:F56',states);
intake.getRange('B7:B56').dataValidation=stop({type:'list',formula1:'INDIRECT("\'Instructions\'!$B$29:$B$38")'},'Choose a saved pickup location from Instructions.');
list(intake,'I7:I56',['Compare all','Cheapest','Fastest','LTL only','FTL only','Cargo van only','Box truck only']);
for(const col of ['Q','R','S','T','U']) list(intake,`${col}7:${col}56`,['Yes','No','Unknown']);
intake.getRange('J7:J56').dataValidation=stop({type:'whole',operator:'between',formula1:1,formula2:26},'Enter 1 to 26 pallets. Larger or mixed loads need review.');
intake.getRange('K7:K56').dataValidation=stop({type:'decimal',operator:'greaterThanOrEqual',formula1:50},'Enter actual pounds per pallet, at least 50. Mode-specific weight limits still apply.');
intake.getRange('L7:N56').dataValidation=stop({type:'decimal',operator:'greaterThan',formula1:0},'Enter the actual dimension in inches, greater than zero.');
intake.getRange('H7:H56').dataValidation=stop({type:'date',operator:'greaterThanOrEqual',formula1:'TODAY()'},'Enter a real date today or later. Do not move a requested date without agreement.');
for(const [s,r,cell] of [[intake,'G7:G56','G7'],[instructions,'C29:C38','C29']]) {
  s.getRange(r).dataValidation=stop({type:'custom',formula1:`AND(LEN(${cell})=5,IFERROR(TEXT(VALUE(${cell}),"00000")=${cell},FALSE))`},'Enter a five-digit ZIP as text, including leading zeros. Verify the actual facility ZIP.');
}
intake.getRange('A7:A56').conditionalFormats.addCustom('AND(A7<>"",COUNTIF($A$7:$A$56,A7)>1)',{fill:'#FFE2E2',font:{color:'#A51D28'}});
instructions.getRange('B29:B38').conditionalFormats.addCustom('AND(B29<>"",COUNTIF($B$29:$B$38,B29)>1)',{fill:'#FFE2E2',font:{color:'#A51D28'}});
list(results,'L7:L106',['Yes','No','Needs confirmation']);
list(results,'R7:R106',['Matched historical invoice vs quote','Matched current quotes','Not comparable','Missing baseline']);
text(results,'A4:L4','Optional baseline columns: compare only fully matched requirements, charges and service. Difference = baseline minus candidate. Keep higher-cost options visible. Do not annualize or call it realized savings.',42,{color:colors.muted});
w.recalculate();
console.log((await w.inspect({kind:'sheet',include:'id,name',maxChars:1500})).ndjson);
for (const [sheetName,range,file] of [['Instructions','A1:F42','instructions'],['Intake','A1:K12','intake'],['Intake','L6:X12','intake-services'],['Results','A1:L12','results'],['Results','M6:U12','results-evidence']]) {
  const p=await w.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(path.join(out,`${file}.png`),new Uint8Array(await p.arrayBuffer()));
}
const blob=await SpreadsheetFile.exportXlsx(w);
await blob.save(path.join(out,'warp-shipment-intake.xlsx'));
await fs.mkdir(path.join(repo,'public/downloads'),{recursive:true});
await fs.copyFile(path.join(out,'warp-shipment-intake.xlsx'),path.join(repo,'public/downloads/warp-shipment-intake.xlsx'));
console.log('Saved',path.join(out,'warp-shipment-intake.xlsx'));
