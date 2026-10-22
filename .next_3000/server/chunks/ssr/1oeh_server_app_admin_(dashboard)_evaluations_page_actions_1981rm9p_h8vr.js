module.exports=[10603,a=>{"use strict";var b=a.i(37936),c=a.i(88215),d=a.i(20539),e=a.i(33430);async function f(a){let{user:b}=await (0,c.f)(),f=e.D.parse(a),{data:g,error:h}=await d.f.from("evaluations").select("*").eq("id",f.evaluation_id).single();if(h||!g)throw Error(`Evaluation not found: ${h?.message||"Invalid ID"}`);let{data:i,error:j}=await d.f.from("evaluations").update({status:f.status,updated_at:new Date().toISOString()}).eq("id",f.evaluation_id).select().single();if(j)throw Error(`Failed to update evaluation status: ${j.message}`);return d.f.from("audit_logs").insert([{action:"EVALUATION_STATUS_OVERRIDE",entity_type:"evaluation",entity_id:f.evaluation_id,admin_id:b.id,details:{previous_status:g.status,new_status:f.status,reason:f.reason},created_at:new Date().toISOString()}]),{evaluation:i,success:!0}}async function g(){let a=async()=>{let[a,b]=await Promise.all([d.f.from("evaluations").select(`
          id,
          total_score,
          status,
          created_at,
          updated_at,
          round_id,
          judge_id,
          team_id
        `).order("created_at",{ascending:!1}).limit(100),d.f.from("evaluation_rounds").select("id, title").order("sequence_order",{ascending:!0})]);return{evaluations:a.data||[],rounds:b.data||[]}},b=new Promise(a=>setTimeout(()=>a({evaluations:[],rounds:[]}),2500));return Promise.race([a(),b])}(0,a.i(13095).ensureServerEntryExports)([f,g]),(0,b.registerServerReference)(f,"4093f1ab8dd1e690bb77c62cdfe9613993c49dba57",null),(0,b.registerServerReference)(g,"00e6fb353867ff20e61caf95fcfb11b1ac085db31f",null),a.s(["4093f1ab8dd1e690bb77c62cdfe9613993c49dba57",0,f],10603)}];

//# sourceMappingURL=1oeh_server_app_admin_%28dashboard%29_evaluations_page_actions_1981rm9p_h8vr.js.map