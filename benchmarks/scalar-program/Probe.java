package org.rafaelaugusto.jolt;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
public final class Probe {
    public static void main(String[] args) throws Exception {
        JSONArray fixtures = new JSONArray(new String(Files.readAllBytes(Paths.get(args[0])), "UTF-8"));
        for (int i=0; i<fixtures.length(); i++) {
            JSONObject fixture=fixtures.getJSONObject(i); JSONArray sources=fixture.getJSONArray("sources");
            double[] values=new double[sources.length()], velocities=new double[sources.length()];
            for(int j=0; j<sources.length(); j++) { values[j]=sources.getJSONObject(j).getDouble("value"); velocities[j]=sources.getJSONObject(j).getDouble("velocity"); }
            ScalarProgram program=new ScalarProgram(fixture.getJSONArray("program").toString(), sources.length());
            program.evaluate(values,velocities);
            System.out.println(program.value()+","+program.velocity());
        }
    }
}
