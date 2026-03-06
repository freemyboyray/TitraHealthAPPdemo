import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PhaseType, SideEffectType } from '../../stores/log-store';
import { useLogStore } from '../../stores/log-store';

const BG='#141210', ORANGE='#E8831A', DARK='#FFFFFF';
const SHADOW={shadowColor:'#000000',shadowOffset:{width:0,height:8} as const,shadowOpacity:0.12,shadowRadius:24,elevation:8};

const SYMPTOMS:{label:string;value:SideEffectType}[]=[
  {label:'Nausea',value:'nausea'},{label:'Vomiting',value:'vomiting'},{label:'Fatigue',value:'fatigue'},
  {label:'Constipation',value:'constipation'},{label:'Diarrhea',value:'diarrhea'},{label:'Headache',value:'headache'},
  {label:'Injection Site Pain',value:'injection_site'},{label:'Loss of Appetite',value:'appetite_loss'},{label:'Other',value:'other'},
];
const PHASES:{label:string;value:PhaseType}[]=[
  {label:'Shot Day',value:'shot'},{label:'Peak',value:'peak'},{label:'Balance',value:'balance'},{label:'Reset',value:'reset'},
];
function sevColor(l:number){
  if(l<=3) return {bg:'rgba(43,148,80,0.12)',border:'rgba(43,148,80,0.5)',fill:'rgba(43,148,80,1)'};
  if(l<=6) return {bg:'rgba(220,160,0,0.12)',border:'rgba(220,160,0,0.55)',fill:'rgba(220,160,0,1)'};
  return {bg:'rgba(200,50,50,0.12)',border:'rgba(200,50,50,0.5)',fill:'rgba(200,50,50,1)'};
}
function GB({r=24}:{r?:number}){
  return <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:r,borderWidth:1,borderTopColor:'rgba(255,255,255,0.13)',borderLeftColor:'rgba(255,255,255,0.08)',borderRightColor:'rgba(255,255,255,0.03)',borderBottomColor:'rgba(255,255,255,0.02)'}}/>;
}
function Card({children,mt=0}:{children:React.ReactNode;mt?:number}){
  return(
    <View style={{borderRadius:24,marginTop:mt,...SHADOW}}>
      <View style={{borderRadius:24,overflow:'hidden',backgroundColor:'#1E1B17'}}>
        <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={[StyleSheet.absoluteFillObject,{borderRadius:24,backgroundColor:'rgba(255,255,255,0.04)'}]}/>
        <GB r={24}/>
        <View style={{padding:20}}>{children}</View>
      </View>
    </View>
  );
}
const SL=({t}:{t:string})=><Text style={{fontSize:11,fontWeight:'700',color:'#5A5754',letterSpacing:3.5,textTransform:'uppercase',marginBottom:16}}>{t}</Text>;

export default function SideEffectsScreen(){
  const router=useRouter(); const insets=useSafeAreaInsets();
  const {addSideEffectLog}=useLogStore();
  const [sel,setSel]=useState<Set<SideEffectType>>(new Set());
  const [sev,setSev]=useState(5);
  const [phase,setPhase]=useState<PhaseType>('balance');
  const [notes,setNotes]=useState('');
  const [loading,setLoading]=useState(false);
  const has=sel.size>0;
  function toggle(v:SideEffectType){setSel(p=>{const n=new Set(p);n.has(v)?n.delete(v):n.add(v);return n;});}
  async function save(){
    if(!has||loading) return; setLoading(true);
    try{for(const t of sel) await addSideEffectLog(t,sev,phase,notes.trim()||undefined); router.back();}
    finally{setLoading(false);}
  }
  return(
    <KeyboardAvoidingView style={{flex:1,backgroundColor:BG}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:insets.top+10,paddingBottom:14,backgroundColor:BG}}>
        <TouchableOpacity style={{width:40,height:40,borderRadius:20,overflow:'hidden',alignItems:'center',justifyContent:'center',...SHADOW,shadowOpacity:0.08,shadowRadius:12}} onPress={()=>router.back()} activeOpacity={0.7}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={[StyleSheet.absoluteFillObject,{borderRadius:20,backgroundColor:'rgba(255,255,255,0.08)'}]}/>
          <GB r={20}/><Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)"/>
        </TouchableOpacity>
        <Text style={{fontSize:18,fontWeight:'800',color:DARK}}>Side Effects</Text>
        <View style={{width:40}}/>
      </View>
      <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:20,paddingTop:4,paddingBottom:insets.bottom+100}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card>
          <SL t="WHAT ARE YOU EXPERIENCING?"/>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
            {SYMPTOMS.map(({label,value})=>{
              const a=sel.has(value);
              return(
                <TouchableOpacity key={value} onPress={()=>toggle(value)} activeOpacity={0.75}
                  style={{borderRadius:20,overflow:'hidden',paddingVertical:10,paddingHorizontal:16,...SHADOW,shadowOpacity:0.07,shadowRadius:8,shadowOffset:{width:0,height:3},shadowColor:a?ORANGE:'#000'}}>
                  {a?<View style={[StyleSheet.absoluteFillObject,{borderRadius:20,backgroundColor:'rgba(232,131,26,0.9)'}]}/>
                    :<><View style={[StyleSheet.absoluteFillObject,{borderRadius:20,backgroundColor:'#252219'}]}/></>}
                  <GB r={20}/><Text style={{fontSize:14,fontWeight:'600',color:a?'#FFF':'#9A9490'}}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
        {has&&<>
          <Card mt={16}>
            <SL t="HOW SEVERE? (1–10)"/>
            <View style={{flexDirection:'row',gap:5,marginBottom:10}}>
              {Array.from({length:10},(_,i)=>i+1).map(l=>{
                const c=sevColor(l); const a=sev===l;
                return(
                  <TouchableOpacity key={l} onPress={()=>setSev(l)} activeOpacity={0.75}
                    style={{flex:1,height:40,borderRadius:20,borderWidth:2,alignItems:'center',justifyContent:'center',backgroundColor:a?c.fill:c.bg,borderColor:c.border}}>
                    <Text style={{fontSize:13,fontWeight:'800',color:a?'#FFF':'#9A9490'}}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              {['Mild','Moderate','Severe'].map(l=><Text key={l} style={{fontSize:10,fontWeight:'600',color:'#5A5754',textTransform:'uppercase',letterSpacing:0.5}}>{l}</Text>)}
            </View>
          </Card>
          <Card mt={16}>
            <SL t="CURRENT PHASE"/>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
              {PHASES.map(({label,value})=>{
                const a=phase===value;
                return(
                  <TouchableOpacity key={value} onPress={()=>setPhase(value)} activeOpacity={0.75}
                    style={{borderRadius:20,overflow:'hidden',paddingVertical:10,paddingHorizontal:16,...SHADOW,shadowOpacity:0.07,shadowRadius:8,shadowOffset:{width:0,height:3}}}>
                    {a?<View style={[StyleSheet.absoluteFillObject,{borderRadius:20,backgroundColor:'rgba(232,131,26,0.9)'}]}/>
                      :<><View style={[StyleSheet.absoluteFillObject,{borderRadius:20,backgroundColor:'#252219'}]}/></>}
                    <GB r={20}/><Text style={{fontSize:14,fontWeight:'600',color:a?'#FFF':'#9A9490'}}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </>}
        <Card mt={16}>
          <SL t="ADDITIONAL NOTES"/>
          <View style={{borderRadius:16,overflow:'hidden',minHeight:90}}>
            <View style={[StyleSheet.absoluteFillObject,{borderRadius:16,backgroundColor:'rgba(255,255,255,0.07)'}]}/>
            <GB r={16}/>
            <TextInput style={{fontSize:15,color:DARK,padding:14,minHeight:90,lineHeight:22}} placeholder="Describe how you're feeling…" placeholderTextColor="rgba(255,255,255,0.25)" value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" blurOnSubmit/>
          </View>
        </Card>
      </ScrollView>
      <View style={{paddingHorizontal:20,paddingTop:12,paddingBottom:insets.bottom+16,backgroundColor:BG,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)'}}>
        <TouchableOpacity style={{backgroundColor:has?ORANGE:'rgba(232,131,26,0.2)',borderRadius:28,paddingVertical:17,alignItems:'center',justifyContent:'center',shadowColor:ORANGE,shadowOffset:{width:0,height:8},shadowOpacity:has?0.35:0,shadowRadius:20,elevation:has?10:0}} onPress={save} activeOpacity={has?0.8:1} disabled={!has||loading}>
          {loading?<ActivityIndicator color="#FFF" size="small"/>:<Text style={{fontSize:16,fontWeight:'800',color:has?'#FFF':'rgba(255,255,255,0.25)',letterSpacing:0.4}}>Log Side Effects</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
const s=StyleSheet.create({});
