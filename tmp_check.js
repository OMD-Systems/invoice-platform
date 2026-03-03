const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const js = fs.readFileSync('js/config.js', 'utf8');
const urlMatch = js.match(/SUPABASE_URL\s*=\s*['"`](.*?)['"`]/);
const keyMatch = js.match(/SUPABASE_ANON_KEY\s*=\s*['"`](.*?)['"`]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
    const { data } = await supabase.from('employees').select('name, rate_usd, employee_type').ilike('name', '%Ihor%');
    console.log('Ihor data:', data);
}
run();
