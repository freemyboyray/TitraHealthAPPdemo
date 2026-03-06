import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogStore } from '../../stores/log-store';

const BG = '#000000', ORANGE = '#FF742A', DARK = '#FFFFFF', WHITE = '#FFFFFF';
const SHADOW = { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 } as const, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 };
const LB_TO_KG = 0.453592;

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }
function GlassBorder({ r = 28 }: { r?: number }) {
  return <View pointerEvents="none" style={{ position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:r,borderWidth:1,borderTopColor:'rgba(255,255,255,0.13)',borderLeftColor:'rgba(255,255,255,0.08)',borderRightColor:'rgba(255,255,255,0.03)',borderBottomColor:'rgba(255,255,255,0.02)' }} />;
}
function StepBtn({ icon, onPress, disabled }: { icon:'add'|'remove'; onPress:()=>void; disabled:boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={[s.stepBtn, disabled&&{opacity:0.35}]}>
      <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={[StyleSheet.absoluteFillObject,{borderRadius:32,backgroundColor:'rgba(255,255,255,0.04)'}]}/>
      <GlassBorder r={32}/>
      <Ionicons name={icon} size={30} color={DARK}/>
    </TouchableOpacity>
  );
}
type Unit = 'lbs'|'kg';
export default function LogWeightScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const { loading, addWeightLog } = useLogStore();
  const [unit, setUnit] = useState<Unit>('lbs');
  const [lbs, setLbs] = useState(185.0);
  const [notes, setNotes] = useState('');
  const disp = unit==='lbs' ? lbs : parseFloat((lbs*LB_TO_KG).toFixed(1));
  const mn = unit==='lbs' ? 50 : 22, mx = unit==='lbs' ? 999 : 453;
  function step(d:number) {
    if(unit==='lbs') setLbs(p=>clamp(parseFloat((p+d).toFixed(1)),50,999));
    else { const nk=clamp(parseFloat((disp+d).toFixed(1)),22,453); setLbs(parseFloat((nk/LB_TO_KG).toFixed(4))); }
  }
  async function save() {
    if(loading) return;
    await addWeightLog(parseFloat(lbs.toFixed(1)), notes.trim());
    router.back();
  }
  return (
    <KeyboardAvoidingView style={{flex:1,backgroundColor:BG}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={{height:insets.top,backgroundColor:BG}}/>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} activeOpacity={0.7} style={s.back}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={[StyleSheet.absoluteFillObject,{borderRadius:22,backgroundColor:'rgba(255,255,255,0.08)'}]}/>
          <GlassBorder r={22}/><Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)"/>
        </TouchableOpacity>
        <Text style={s.title}>Log Weight</Text>
        <View style={{width:44}}/>
      </View>
      <ScrollView contentContainerStyle={[s.scroll,{paddingBottom:insets.bottom+32}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.date}>{new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</Text>
        <View style={[s.card,{marginBottom:16}]}>
          <View style={{borderRadius:28,overflow:'hidden',backgroundColor:'#111111'}}>
            <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={[StyleSheet.absoluteFillObject,{borderRadius:28,backgroundColor:'rgba(255,255,255,0.04)'}]}/>
            <GlassBorder r={28}/>
            <View style={{alignItems:'center',paddingHorizontal:24,paddingVertical:28}}>
              <Text style={{fontSize:11,fontWeight:'700',color:ORANGE,letterSpacing:3.5,textTransform:'uppercase',marginBottom:22}}>TODAY</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:20,marginBottom:24}}>
                <StepBtn icon="remove" onPress={()=>step(-0.1)} disabled={disp<=mn}/>
                <Text style={{fontSize:72,fontWeight:'800',color:DARK,letterSpacing:-3,lineHeight:78}} adjustsFontSizeToFit numberOfLines={1}>{disp.toFixed(1)}</Text>
                <StepBtn icon="add" onPress={()=>step(0.1)} disabled={disp>=mx}/>
              </View>
              <View style={{flexDirection:'row',backgroundColor:'rgba(255,255,255,0.06)',borderRadius:32,padding:4,marginBottom:14}}>
                {(['lbs','kg'] as Unit[]).map(u=>(
                  <TouchableOpacity key={u} onPress={()=>setUnit(u)} activeOpacity={0.8}
                    style={[{paddingHorizontal:26,paddingVertical:9,borderRadius:28},unit===u&&{backgroundColor:ORANGE}]}>
                    <Text style={{fontSize:13,fontWeight:'700',letterSpacing:2,color:unit===u?WHITE:'#9A9490'}}>{u.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{fontSize:11,color:'#5A5754',letterSpacing:1.5,textTransform:'uppercase'}}>{mn} – {mx} {unit.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <View style={[s.card,{marginBottom:24}]}>
          <View style={{borderRadius:24,overflow:'hidden',backgroundColor:'#111111'}}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={[StyleSheet.absoluteFillObject,{borderRadius:24,backgroundColor:'rgba(255,255,255,0.04)'}]}/>
            <GlassBorder r={24}/>
            <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:18,paddingVertical:16}}>
              <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.35)" style={{marginRight:10}}/>
              <TextInput style={{flex:1,fontSize:16,fontWeight:'500',color:DARK}} placeholder="Add a note… (optional)" placeholderTextColor="rgba(255,255,255,0.25)" value={notes} onChangeText={setNotes} returnKeyType="done" maxLength={200}/>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={save} activeOpacity={0.85} disabled={loading} style={[s.saveBtn,loading&&{opacity:0.75}]}>
          {loading ? <ActivityIndicator color={WHITE} size="small"/> : <Text style={{fontSize:17,fontWeight:'700',color:'#000000',letterSpacing:0.5}}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:8},
  back:{width:44,height:44,borderRadius:22,overflow:'hidden',alignItems:'center',justifyContent:'center',...SHADOW,shadowOpacity:0.08,shadowRadius:12},
  title:{fontSize:18,fontWeight:'700',color:DARK},
  scroll:{paddingHorizontal:20,paddingTop:4},
  date:{fontSize:11,fontWeight:'600',color:'#5A5754',textAlign:'center',letterSpacing:3.5,marginBottom:20},
  card:{borderRadius:28,...SHADOW},
  stepBtn:{width:64,height:64,borderRadius:32,overflow:'hidden',alignItems:'center',justifyContent:'center',...SHADOW,shadowOpacity:0.1,shadowRadius:16},
  saveBtn:{height:56,borderRadius:28,backgroundColor:ORANGE,alignItems:'center',justifyContent:'center',shadowColor:ORANGE,shadowOffset:{width:0,height:8},shadowOpacity:0.4,shadowRadius:20,elevation:8},
});
