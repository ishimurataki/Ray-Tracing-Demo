export const TracerVertexSource = `
    attribute vec3 vertex;
    uniform vec3 ray00, ray01, ray10, ray11;
    varying vec3 initialRay;
    void main() {
        vec2 percent = vertex.xy * 0.5 + 0.5;
        initialRay = mix(mix(ray00, ray01, percent.y), mix(ray10, ray11, percent.y), percent.x);
        gl_Position = vec4(vertex, 1.0);
    }
`;
export const TracerFragmentSource = (width, height) => {
    return `precision highp float;
            uniform vec3 eye;
            varying vec3 initialRay;
            uniform float textureWeight;
            uniform float timeSinceStart;
            uniform sampler2D texture;
            uniform vec3 light;

            uniform vec3 sphere1Center;
            uniform float sphere1Radius;

            uniform vec3 sphere2Center;
            uniform float sphere2Radius;

            vec3 roomCubeMin = vec3(-1.0);
            vec3 roomCubeMax = vec3(1.0);

            uniform sampler2D ceilingTexture;
            
            float intersectSphere(vec3 origin, vec3 ray, vec3 sphereCenter, float sphereRadius) {
                vec3 toSphere = origin - sphereCenter;
                float a = dot(ray, ray);
                float b = 2.0 * dot(toSphere, ray);
                float c = dot(toSphere, toSphere) - sphereRadius * sphereRadius;
                float discriminant = b * b - 4.0 * a * c;

                if (discriminant > 0.0) {
                    float t = (-b - sqrt(discriminant)) / (2.0 * a);
                    if (t > 0.0) return t;
                }
                return 10000.0;
            }

            vec3 normalForSphere(vec3 hit, vec3 sphereCenter, float sphereRadius) {
                return (hit - sphereCenter) / sphereRadius;
            }

            vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {
                vec3 t1 = (cubeMin - origin) / ray;
                vec3 t2 = (cubeMax - origin) / ray;
                
                vec3 tMin = min(t1, t2);
                vec3 tMax = max(t1, t2);

                float tNear = max(tMin.x, max(tMin.y, tMin.z));
                float tFar = min(tMax.x, min(tMax.y, tMax.z));

                return vec2(tNear, tFar);
            }

            vec3 normalForCube(vec3 hit, vec3 cubeMin, vec3 cubeMax) {
            if (hit.x < cubeMin.x + 0.0001) return vec3(-1.0, 0.0, 0.0);
            else if(hit.x > cubeMax.x - 0.0001) return vec3(1.0, 0.0, 0.0);
            else if(hit.y < cubeMin.y + 0.0001) return vec3(0.0, -1.0, 0.0);
            else if(hit.y > cubeMax.y - 0.0001) return vec3(0.0, 1.0, 0.0);
            else if(hit.z < cubeMin.z + 0.0001) return vec3(0.0, 0.0, -1.0);
            else return vec3(0.0, 0.0, 1.0);
            }

            float random(vec3 scale, float seed) {
                return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
            }

            vec3 cosineWeightedDirection(float seed, vec3 normal) {
                float u = random(vec3(12.9898, 78.233, 151.7182), seed);
                float v = random(vec3(63.7264, 10.873, 623.6736), seed);
                float r = sqrt(u);
                float angle = 6.283185307179586 * v;
                // compute basis from normal
                vec3 sdir, tdir;
                if (abs(normal.x) < .5) {
                    sdir = cross(normal, vec3(1,0,0));
                } else {
                    sdir = cross(normal, vec3(0,1,0));
                }
                tdir = cross(normal, sdir);
                return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.-u)*normal;
            }

            vec3 uniformlyRandomDirection(float seed) {
                float u = random(vec3(12.9898, 78.233, 151.7182), seed);
                float v = random(vec3(63.7264, 10.873, 623.6736), seed);
                float z = 1.0 - 2.0 * u;
                float r = sqrt(1.0 - z * z);
                float angle = 6.283185307179586 * v;
                return vec3(r * cos(angle), r * sin(angle), z);
            }

            vec3 uniformlyRandomVector(float seed) {
                return uniformlyRandomDirection(seed) * sqrt(random(vec3(36.7539, 50.3658, 306.2759), seed));
            }

            float shadow(vec3 origin, vec3 ray, vec3 sphereCenter, float sphereRadius) {
                float tSphere = intersectSphere(origin, ray, sphereCenter, sphereRadius);
                if (tSphere < 1.0) return 0.0;
                return 1.0;
            }

            vec3 calculateColor(vec3 origin, vec3 ray, vec3 light) {

                vec3 colorMask = vec3(1.0);
                vec3 accumulatedColor = vec3(0.0);
                vec3 surface1Color = vec3(0.75);
                vec3 surface2Color = vec3(0.75, 0.5, 0.3);

                for (int bounce = 0; bounce < 5; bounce++) {
                    float t = 10000.0;
                    float specularHighlight = 0.0;

                    vec2 tRoom = intersectCube(origin, ray, roomCubeMin, roomCubeMax);
                    if (tRoom.x < tRoom.y) t = tRoom.y;

                    float tSphere1 = intersectSphere(origin, ray, sphere1Center, sphere1Radius);
                    float tSphere2 = intersectSphere(origin, ray, sphere2Center, sphere2Radius);

                    if (tSphere1 < t) {
                        t = tSphere1;
                    }
                    if (tSphere2 < t) {
                        t = tSphere2;
                    }
                    
                    vec3 hit = origin + ray * t;
                    vec3 toLight = light - hit;
                    vec3 normal;
                    vec3 surfaceColor = vec3(0.75);
                    vec3 sphereCenter;
                    float sphereRadius;

                    if (t > 9999.9) {
                        break;
                    } else if (t == tRoom.y) {
                        normal = -normalForCube(hit, roomCubeMin, roomCubeMax);
                        if (hit.x < -0.9999) {
                            surfaceColor = vec3(0.1, 0.5, 1.0);
                        } else if (hit.x > 0.9999) {
                            surfaceColor = vec3(1.0, 0.9, 0.1);
                        } else if (hit.y > 0.9999) {
                            surfaceColor = texture2D(ceilingTexture, (hit.xz + 1.0) / 2.0).rgb;
                        }
                        ray = cosineWeightedDirection(timeSinceStart + float(bounce), normal);
                    } else {
                        if (t == tSphere1) {
                            sphereCenter = sphere1Center;
                            sphereRadius = sphere1Radius;
                            surfaceColor = surface1Color;
                        } else {
                            sphereCenter = sphere2Center;
                            sphereRadius = sphere2Radius;
                            surfaceColor = surface2Color;
                        }
                        normal = normalForSphere(hit, sphereCenter, sphereRadius);
                        ray = reflect(ray, normal);
                        vec3 reflectedLight = normalize(reflect(toLight, normal));
                        float specularHighlight = max(0.0, dot(reflectedLight, normalize(hit - origin)));
                        specularHighlight = 2.0 * pow(specularHighlight, 20.0);
                    }
                    float diffuse = max(0.0, dot(normalize(toLight), normal)); // TODO: UNDERSTAND WHAT THIS DOES

                    float shadowIntensity = 1.0;
                    if (intersectSphere(hit + normal * 0.0001, toLight, sphere1Center, sphere1Radius) < 1.0 ||
                        intersectSphere(hit + normal * 0.0001, toLight, sphere2Center, sphere2Radius) < 1.0) {
                            shadowIntensity = 0.0;
                    }

                    colorMask *= surfaceColor;
                    accumulatedColor += colorMask * (0.5 * diffuse * shadowIntensity);
                    accumulatedColor += colorMask * specularHighlight * shadowIntensity;

                    origin = hit;
                }
                return accumulatedColor;
            }

            void main() {
                vec3 newLight = light + uniformlyRandomVector(timeSinceStart - 53.0) * 0.1;
                vec2 texCoord = vec2(gl_FragCoord.x / ${width.toFixed(1)}, gl_FragCoord.y / ${height.toFixed(1)});
                vec3 texture = texture2D(texture, texCoord).rgb;
                gl_FragColor = vec4(mix(calculateColor(eye, initialRay, newLight), texture, textureWeight), 1.0);
            }`;
};
